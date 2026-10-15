import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  authenticate, boundedInt, errorResponse, isUuid, json, preflight, rateLimit, readJson,
  requireConfig, requireRole, rest, sha256Hex, STAFF_ROLES, timingSafeEqual,
} from "../_shared/http.ts";

// ---------------------------------------------------------------------------
// iot-ingest
//  POST /ingest            REAL devices only. Auth: X-Device-Id + X-Device-Key (per-device secret,
//                          stored as SHA-256 hash in iot_devices.api_key_hash). No user JWT needed.
//  POST /devices/:id/key   admin: (re)generate a device key. Shown ONCE.
//  POST /simulate          staff, only if IOT_SIMULATION_ENABLED=true. Rows are stored with
//                          is_simulated=true and never feed real indicators or AI.
//  GET  /devices, /telemetry/:id, /stats   staff / authenticated reads
// ---------------------------------------------------------------------------

const SIMULATION_ENABLED = Deno.env.get("IOT_SIMULATION_ENABLED") === "true";
const MAX_AGE_MS = 24 * 3600 * 1000;
const MAX_FUTURE_MS = 5 * 60 * 1000;

// Allowed metrics per device type with physically plausible bounds.
const METRICS: Record<string, Record<string, { unit: string; min: number; max: number }>> = {
  streetlight:   { luminance: { unit: "lux", min: 0, max: 100000 } },
  waste_bin:     { fill_level: { unit: "%", min: 0, max: 100 } },
  water_meter:   { flow_rate: { unit: "L/min", min: 0, max: 100000 } },
  energy_meter:  { power: { unit: "kW", min: 0, max: 100000 } },
  traffic_light: { phase: { unit: "state", min: 0, max: 8 } },
  camera:        { vehicle_count: { unit: "vehicles", min: 0, max: 10000 } },
  air_sensor:    { pm25: { unit: "µg/m³", min: 0, max: 1000 } },
  noise_sensor:  { noise_db: { unit: "dB", min: 0, max: 200 } },
  flood_sensor:  { water_level: { unit: "cm", min: 0, max: 5000 } },
};

async function ingest(req: Request): Promise<Response> {
  const deviceId = req.headers.get("X-Device-Id") ?? "";
  const key = req.headers.get("X-Device-Key") ?? "";
  if (!/^[A-Za-z0-9_.:-]{3,64}$/.test(deviceId) || key.length < 32 || key.length > 128) {
    return errorResponse("Identifiants appareil invalides.", 401, req);
  }
  if (!(await rateLimit(`iot:${deviceId}`, 120, 60))) return errorResponse("Trop de messages (120/min max).", 429, req);

  const d = await rest(`/rest/v1/iot_devices?device_id=eq.${encodeURIComponent(deviceId)}&select=id,type,status,is_simulated`);
  const device = Array.isArray(d.data) ? d.data[0] : null;
  let storedHash = "";
  if (device && isUuid(device.id)) {
    const c = await rest(`/rest/v1/iot_device_credentials?device_id=eq.${device.id}&select=api_key_hash`);
    storedHash = Array.isArray(c.data) && c.data[0] ? String(c.data[0].api_key_hash) : "";
  }
  const given = await sha256Hex(key);
  // Same error for unknown device and wrong key: no device enumeration.
  if (!device || !storedHash || device.is_simulated || !timingSafeEqual(given, storedHash)) {
    return errorResponse("Authentification appareil refusée.", 401, req);
  }
  if (device.status === "maintenance") return errorResponse("Appareil en maintenance : mesure refusée.", 409, req);

  const parsed = await readJson(req, 2_048);
  if (!parsed.ok) return parsed.res;
  const { metric, value, recorded_at } = parsed.body;
  const spec = METRICS[device.type]?.[metric];
  if (!spec) return errorResponse(`Métrique « ${String(metric).slice(0, 40)} » non autorisée pour ce type d'appareil.`, 422, req);
  if (typeof value !== "number" || !Number.isFinite(value) || value < spec.min || value > spec.max) {
    return errorResponse(`Valeur hors plage physique [${spec.min}, ${spec.max}] ${spec.unit}.`, 422, req);
  }
  const ts = Date.parse(String(recorded_at));
  const now = Date.now();
  if (!Number.isFinite(ts)) return errorResponse("recorded_at (ISO 8601) requis.", 422, req);
  if (now - ts > MAX_AGE_MS) return errorResponse("Mesure trop ancienne (> 24 h) : rejetée.", 422, req);
  if (ts - now > MAX_FUTURE_MS) return errorResponse("Horodatage dans le futur : rejeté.", 422, req);

  const ins = await rest("/rest/v1/iot_telemetry", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      device_id: device.id, metric, value, unit: spec.unit, quality: "good",
      is_simulated: false, recorded_at: new Date(ts).toISOString(),
    }),
  });
  if (ins.status === 409) return errorResponse("Mesure déjà reçue (rejeu ignoré).", 409, req);
  if (!ins.ok) return errorResponse("Écriture impossible.", 500, req);
  await rest(`/rest/v1/iot_devices?id=eq.${device.id}`, {
    method: "PATCH",
    body: JSON.stringify({ last_seen: new Date().toISOString(), status: device.status === "offline" ? "online" : device.status }),
  });
  return json({ success: true, telemetry_id: ins.data?.[0]?.id }, 201, req);
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  const cfg = requireConfig(req);
  if (cfg) return cfg;

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/(functions\/v1\/)?iot-ingest/, "");

    // Device channel: no user session.
    if (path === "/ingest" && req.method === "POST") return await ingest(req);

    const auth = await authenticate(req);
    if ("error" in auth) return auth.error;
    const { role } = auth;

    const keyMatch = path.match(/^\/devices\/([0-9a-f-]{36})\/key$/i);
    if (keyMatch && req.method === "POST") {
      if (!requireRole(role, ["admin"])) return errorResponse("Réservé aux administrateurs.", 403, req);
      if (!isUuid(keyMatch[1])) return errorResponse("Identifiant invalide.", 400, req);
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const secret = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
      const dv = await rest(`/rest/v1/iot_devices?id=eq.${keyMatch[1]}&is_simulated=eq.false&select=id,device_id`);
      if (!Array.isArray(dv.data) || dv.data.length === 0) return errorResponse("Appareil réel introuvable.", 404, req);
      const r = await rest("/rest/v1/iot_device_credentials", {
        method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ device_id: keyMatch[1], api_key_hash: await sha256Hex(secret), rotated_at: new Date().toISOString() }),
      });
      if (!r.ok) return errorResponse("Enregistrement de la clé impossible.", 500, req);
      return json({ device_id: dv.data[0].device_id, device_key: secret,
        warning: "Cette clé n'est affichée qu'une seule fois. Stockez-la dans l'appareil." }, 200, req);
    }

    if (path === "/simulate" && req.method === "POST") {
      if (!requireRole(role, ["admin"])) return errorResponse("Réservé aux administrateurs.", 403, req);
      if (!SIMULATION_ENABLED) {
        return json({ error: "simulation_disabled", message: "Simulation désactivée (IOT_SIMULATION_ENABLED != true)." }, 403, req);
      }
      const dev = await rest("/rest/v1/iot_devices?is_simulated=eq.true&select=id,type&limit=200");
      const devices: any[] = Array.isArray(dev.data) ? dev.data : [];
      let count = 0;
      for (const dv of devices) {
        const specs = METRICS[dv.type];
        if (!specs) continue;
        const [metric, spec] = Object.entries(specs)[0];
        const value = Math.round((spec.min + Math.random() * (spec.max - spec.min) * 0.2) * 100) / 100;
        const r = await rest("/rest/v1/iot_telemetry", {
          method: "POST",
          body: JSON.stringify({ device_id: dv.id, metric, value, unit: spec.unit, quality: "questionable", is_simulated: true }),
        });
        if (r.ok) count++;
      }
      return json({ success: true, simulated: count, label: "SIMULATION", warning: "Mesures simulées : exclues des indicateurs réels." }, 200, req);
    }

    if (path === "/devices" && req.method === "GET") {
      const r = await rest("/rest/v1/rpc/get_iot_devices_with_coords", { method: "POST", body: "{}" });
      return json({ data: Array.isArray(r.data) ? r.data : [] }, 200, req);
    }

    const tm = path.match(/^\/telemetry\/([0-9a-f-]{36})$/i);
    if (tm && req.method === "GET") {
      if (!requireRole(role, STAFF_ROLES)) return errorResponse("Accès refusé.", 403, req);
      if (!isUuid(tm[1])) return errorResponse("Identifiant invalide.", 400, req);
      const limit = boundedInt(url.searchParams.get("limit"), 50, 1, 500);
      const r = await rest(`/rest/v1/iot_telemetry?device_id=eq.${tm[1]}&order=recorded_at.desc&limit=${limit}`);
      return json({ data: r.data }, 200, req);
    }

    if (path === "/stats" && req.method === "GET") {
      if (!requireRole(role, STAFF_ROLES)) return errorResponse("Accès refusé.", 403, req);
      const dv = await rest("/rest/v1/iot_devices?select=id,type,status,is_simulated,last_seen");
      const devices: any[] = Array.isArray(dv.data) ? dv.data : [];
      const real = devices.filter((d) => !d.is_simulated);
      const tally = (arr: any[], k: string) => arr.reduce((m: Record<string, number>, x) => (m[x[k]] = (m[x[k]] ?? 0) + 1, m), {});
      const rt = await rest("/rest/v1/iot_telemetry?is_simulated=eq.false&order=recorded_at.desc&limit=100&select=metric,value,unit,recorded_at");
      return json({
        real_devices: real.length, simulated_devices: devices.length - real.length,
        by_type: tally(real, "type"), by_status: tally(real, "status"),
        recent_real_telemetry: rt.data ?? [],
        note: real.length === 0 ? "Aucun appareil réel enregistré : aucune donnée de capteur réelle." : undefined,
      }, 200, req);
    }

    return errorResponse("Route introuvable.", 404, req);
  } catch (err) {
    console.error("iot-ingest error:", (err as Error)?.message);
    return errorResponse("Erreur interne.", 500, req);
  }
});

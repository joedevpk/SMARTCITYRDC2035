import {
  authenticate, errorResponse, json, preflight, readJson, requireConfig, requireRole,
  rest, STAFF_ROLES, isUuid, oneOf, rateLimit,
} from "../_shared/http.ts";
import {
  buildClassifyUserPayload, callGemini, CLASSIFY_SYSTEM_PROMPT, parseSuggestion, readGeminiConfig,
  type GeminiFailure, type InlineImage,
} from "./gemini.ts";
import { serviceKey, supabaseUrl } from "../_shared/http.ts";
import { sniffImage } from "../_shared/sniff.ts";

// ---------------------------------------------------------------------------
// ai-service (handler testable ; le point d'entrée Deno.serve est dans index.ts)
//  - /status               : indique ce qui est réellement configuré (aucun secret n'est renvoyé)
//  - /classify-report      : VRAI appel à Google Gemini (generateContent) -> JSON validé strictement, relecture humaine obligatoire
//  - /predict/traffic, /predict/energy : statistiques déterministes (moyenne mobile + tendance linéaire)
//                            sur télémétrie RÉELLE uniquement (is_simulated = false). Aucun repli synthétique.
//  - /detect/anomalies     : z-score sur télémétrie réelle
//  - /analyze/incidents    : comptages sur lignes réelles (non démo)
//  - /predictions          : historique (personnel autorisé uniquement)
// Rien n'est enregistré comme « IA » sauf si cela vient réellement du modèle.
//
// Contrôle d'accès : toutes les routes exigent un jeton Supabase valide, un profil actif et un rôle de
// STAFF_ROLES (identique à public.is_staff() côté SQL). Les lectures se font avec la clé service ; elles
// ne dépassent donc pas ce que la RLS accorde déjà à ces rôles (reports : propriétaire OU is_staff()).
// ---------------------------------------------------------------------------

const MIN_POINTS = 12;
const CLASSIFY_PER_HOUR = 20;   // appels Gemini facturables / utilisateur / heure
const FORECAST_PER_HOUR = 60;   // chaque prévision écrit une ligne dans ai_predictions

/** Réponse d'erreur du module IA : { error: <code>, message } (le client lit message ?? error). */
function aiError(req: Request, status: number, code: string, message: string): Response {
  return json({ error: code, message }, status, req);
}

function movingAvg(values: number[], window: number): number[] {
  return values.map((_, i) => {
    const s = values.slice(Math.max(0, i - window + 1), i + 1);
    return s.reduce((a, b) => a + b, 0) / s.length;
  });
}

function linearFit(values: number[]): { slope: number; intercept: number; r2: number } {
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0, ssTot = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) ** 2;
    ssTot += (values[i] - yMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;
  let ssRes = 0;
  for (let i = 0; i < n; i++) ssRes += (values[i] - (slope * i + intercept)) ** 2;
  return { slope, intercept, r2: ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot) };
}

function detectAnomalies(values: number[], threshold: number) {
  if (values.length < MIN_POINTS) return [];
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const std = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
  if (std === 0) return [];
  return values
    .map((v, index) => ({ index, value: v, zscore: Math.abs((v - mean) / std) }))
    .filter((a) => a.zscore > threshold);
}

async function realSeries(metric: string, limit = 96) {
  const r = await rest(
    `/rest/v1/iot_telemetry?metric=eq.${encodeURIComponent(metric)}&is_simulated=eq.false&quality=eq.good` +
      `&order=recorded_at.desc&limit=${limit}&select=device_id,value,recorded_at`,
  );
  const rows: any[] = Array.isArray(r.data) ? r.data : [];
  return rows.reverse();
}

function insufficient(req: Request, metric: string, have: number) {
  return json({
    error: "insufficient_real_data",
    message: `Données réelles insuffisantes pour « ${metric} » : ${have} mesure(s) authentifiée(s), ${MIN_POINTS} minimum requises. Aucune prévision n'est fabriquée.`,
    available_points: have,
    required_points: MIN_POINTS,
  }, 422, req);
}

async function forecast(req: Request, userId: string, metric: string, model: string, unitKey: string) {
  const body = await readJson(req);
  if (!body.ok) return body.res;
  if (!(await rateLimit(`ai-forecast:${userId}`, FORECAST_PER_HOUR, 3600))) {
    return errorResponse(`Quota atteint : ${FORECAST_PER_HOUR} prévisions par heure.`, 429, req);
  }
  const hours = Math.min(24, Math.max(1, Number.parseInt(String(body.body.hours ?? 6), 10) || 6));
  const rows = await realSeries(metric);
  if (rows.length < MIN_POINTS) return insufficient(req, metric, rows.length);

  const values = rows.map((r) => Number(r.value)).filter(Number.isFinite);
  const smoothed = movingAvg(values, 3);
  const fit = linearFit(smoothed);
  const out = Array.from({ length: hours }, (_, i) => ({
    hour: i + 1,
    [unitKey]: Math.max(0, Math.round((fit.slope * (smoothed.length + i) + fit.intercept) * 100) / 100),
  }));
  const anomalies = detectAnomalies(values, 2.5).map((a) => ({ ...a, timestamp: rows[a.index]?.recorded_at }));
  const result = {
    model,
    method: "moving_average_3 + ordinary_least_squares (statistique, pas un modèle d'IA)",
    based_on_points: values.length,
    window: { from: rows[0].recorded_at, to: rows[rows.length - 1].recorded_at },
    fit_r2: Math.round(fit.r2 * 1000) / 1000, // goodness of fit, NOT a probability
    forecast: out,
    anomalies,
    caveat: "Tendance linéaire simple ; ne tient compte ni de la saisonnalité ni des événements.",
  };
  const saved = await rest("/rest/v1/ai_predictions", {
    method: "POST",
    body: JSON.stringify({
      model, target_type: model.split("_")[0], prediction: result, confidence: null,
      features: { points: values.length, provider: "statistics", is_llm: false, requested_by: userId },
    }),
  });
  if (!saved.ok) console.error("ai-service: ai_predictions insert failed, HTTP", saved.status);
  return json({ ...result, persisted: saved.ok }, 200, req);
}

// ---- LLM: classify a citizen report (Google Gemini) ------------------------
const PROVIDER_ERRORS: Record<GeminiFailure, { status: number; code: string; message: string }> = {
  timeout:         { status: 504, code: "ai_provider_timeout", message: "Gemini n'a pas répondu à temps. Réessayez." },
  network:         { status: 502, code: "ai_provider_unreachable", message: "Fournisseur IA (Gemini) injoignable depuis le serveur." },
  auth:            { status: 502, code: "ai_provider_auth", message: "Clé Gemini refusée par Google : vérifiez le secret GEMINI_API_KEY (clé valide, API Gemini activée)." },
  quota:           { status: 429, code: "ai_quota_exceeded", message: "Quota du fournisseur IA (Gemini) atteint, réessayez plus tard." },
  model_not_found: { status: 502, code: "ai_model_unavailable", message: "Modèle Gemini introuvable : vérifiez le secret AI_MODEL (identifiant exact, disponible pour votre clé)." },
  bad_request:     { status: 502, code: "ai_provider_rejected", message: "Gemini a refusé la requête (paramètre invalide). Consultez les journaux de la fonction." },
  unavailable:     { status: 503, code: "ai_provider_unavailable", message: "Service Gemini momentanément indisponible. Réessayez plus tard." },
  provider_error:  { status: 502, code: "ai_provider_error", message: "Réponse inattendue du fournisseur IA." },
  unreadable:      { status: 502, code: "ai_provider_unreadable", message: "Réponse du fournisseur IA illisible. Aucune donnée enregistrée." },
  blocked:         { status: 422, code: "ai_content_blocked", message: "Gemini a bloqué cette analyse (filtre de sécurité). Aucune donnée enregistrée." },
  empty:           { status: 502, code: "ai_empty_response", message: "Gemini n'a renvoyé aucune sortie exploitable. Aucune donnée enregistrée." },
};

function notConfigured(req: Request, missing: string[], invalid: string[]) {
  const parts = [
    ...(missing.length ? [`manquant : ${missing.join(", ")}`] : []),
    ...(invalid.length ? [`invalide : ${invalid.join(", ")}`] : []),
  ];
  return json({
    error: "ai_not_configured",
    message: `IA non configurée (${parts.join(" ; ")}). Définissez GEMINI_API_KEY et AI_MODEL dans les secrets de la fonction.`,
    missing, invalid,
  }, 503, req);
}

// ---- Images jointes : récupération serveur (bucket PRIVÉ, clé service) puis transmission multimodale ----
const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 10 * 1024 * 1024;
const ATT_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Ne lève jamais : retourne les images réellement récupérées + le nombre d'échecs (annoncé à l'agent, jamais masqué). */
async function loadReportImages(reportId: string): Promise<{ images: InlineImage[]; registered: number; failed: number }> {
  let rows: any[] = [];
  try {
    const r = await rest(`/rest/v1/report_attachments?report_id=eq.${reportId}&verified=eq.true&order=created_at.asc&limit=${MAX_IMAGES}&select=storage_path,mime_type,size_bytes`);
    rows = Array.isArray(r.data) ? r.data : [];
  } catch { return { images: [], registered: 0, failed: 0 }; }
  const images: InlineImage[] = [];
  let failed = 0, total = 0;
  for (const row of rows) {
    const mime = row?.mime_type;
    if (!(ATT_MIME as readonly string[]).includes(mime) || typeof row?.storage_path !== "string" ||
        !Number.isFinite(row?.size_bytes) || row.size_bytes > MAX_IMAGE_BYTES || total + row.size_bytes > MAX_TOTAL_IMAGE_BYTES) { failed++; continue; }
    try {
      const path = row.storage_path.split("/").map(encodeURIComponent).join("/");
      const res = await fetch(`${supabaseUrl}/storage/v1/object/report-attachments/${path}`, {
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
      });
      if (!res.ok) { failed++; continue; }
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) { failed++; continue; }
      // Défense en profondeur : on ne transmet à Gemini que des octets dont le type réel correspond.
      if (sniffImage(bytes) !== mime) { failed++; continue; }
      total += bytes.length;
      images.push({ mimeType: mime, data: toBase64(bytes) });
    } catch { failed++; }
  }
  return { images, registered: rows.length, failed };
}

async function classifyReport(req: Request, userId: string) {
  const cfg = readGeminiConfig();
  if (!cfg.ok) return notConfigured(req, cfg.missing, cfg.invalid);
  const { apiKey, model, timeoutMs } = cfg.config;

  const parsed = await readJson(req, 8_192);
  if (!parsed.ok) return parsed.res;
  const { report_id } = parsed.body;
  if (!isUuid(report_id)) return errorResponse("report_id (uuid) requis.", 400, req);

  // Route payante : si le limiteur est indisponible on REFUSE (failOpen:false) plutôt que de laisser l'appel illimité.
  if (!(await rateLimit(`ai-classify:${userId}`, CLASSIFY_PER_HOUR, 3600, { failOpen: false }))) {
    return errorResponse(`Quota atteint : ${CLASSIFY_PER_HOUR} classifications par heure (ou limiteur indisponible).`, 429, req);
  }

  const r = await rest(`/rest/v1/reports?id=eq.${report_id}&select=id,title,description,category,priority,address,created_at`);
  const report = Array.isArray(r.data) ? r.data[0] : null;
  if (!report) return errorResponse("Signalement introuvable.", 404, req);

  const media = await loadReportImages(report.id);
  const result = await callGemini({
    apiKey, model, timeoutMs,
    system: CLASSIFY_SYSTEM_PROMPT,
    user: buildClassifyUserPayload(report),
    images: media.images,
  });
  if (!result.ok) {
    // Journal sans secret ni contenu : seulement la nature de l'échec et les statuts.
    console.error("ai-service: gemini failure", result.kind, result.httpStatus ?? "-", result.providerStatus ?? "-");
    const e = PROVIDER_ERRORS[result.kind];
    return aiError(req, e.status, e.code, e.message);
  }

  const checked = parseSuggestion(result.text, { imagesSent: media.images.length > 0 });
  if (!checked.ok) {
    console.error("ai-service: invalid model output:", checked.reason, "finishReason=", result.finishReason ?? "-");
    return aiError(req, 502, "ai_invalid_model_output",
      checked.reason === "not_json"
        ? "Réponse du modèle invalide (JSON attendu). Aucune donnée enregistrée."
        : "Réponse du modèle hors schéma (champ manquant ou valeur non autorisée). Aucune donnée enregistrée.");
  }
  const suggestion = checked.suggestion;

  const saved = await rest("/rest/v1/ai_predictions", {
    method: "POST",
    body: JSON.stringify({
      model: "report_classification", target_type: "report", target_id: report.id,
      prediction: suggestion, confidence: null,
      features: { provider: "gemini", model, is_llm: true, requested_by: userId, images_analyzed: media.images.length },
    }),
  });
  if (!saved.ok) console.error("ai-service: ai_predictions insert failed, HTTP", saved.status);
  return json({
    model: "report_classification",
    provider: "gemini", llm_model: model,
    requires_human_review: true,
    // Transparence : combien d'images Gemini a RÉELLEMENT reçues (0 = analyse sur le texte seul).
    images: { registered: media.registered, analyzed: media.images.length, failed: media.failed },
    persisted: saved.ok,
    suggestion,
    current: { category: report.category, priority: report.priority },
  }, 200, req);
}

export async function handle(req: Request): Promise<Response> {
  const pre = preflight(req);
  if (pre) return pre;
  const cfg = requireConfig(req);
  if (cfg) return cfg;

  try {
    const auth = await authenticate(req);
    if ("error" in auth) return auth.error;
    const { role, user } = auth;
    if (!requireRole(role, STAFF_ROLES)) return errorResponse("Accès refusé : réservé au personnel autorisé.", 403, req);

    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/(functions\/v1\/)?ai-service/, "");

    if (path === "/status" && req.method === "GET") {
      const c = readGeminiConfig();
      return json({
        llm_configured: c.ok,
        provider: c.ok ? "gemini" : null,
        model: c.ok ? c.config.model : null,
        missing: c.ok ? [] : c.missing,   // noms de secrets uniquement, jamais de valeurs
        invalid: c.ok ? [] : c.invalid,
        min_points: MIN_POINTS,
      }, 200, req);
    }
    if (path === "/classify-report" && req.method === "POST") return await classifyReport(req, user.id);
    if (path === "/predict/traffic" && req.method === "POST") return await forecast(req, user.id, "vehicle_count", "traffic_forecast", "predicted_vehicles");
    if (path === "/predict/energy" && req.method === "POST") return await forecast(req, user.id, "power", "energy_forecast", "predicted_kw");

    if (path === "/detect/anomalies" && req.method === "POST") {
      const metrics = ["flow_rate", "power", "fill_level", "vehicle_count", "pm25"];
      const results: unknown[] = [];
      const counts: Record<string, number> = {};
      for (const metric of metrics) {
        const rows = await realSeries(metric, 100);
        counts[metric] = rows.length;
        for (const a of detectAnomalies(rows.map((r) => Number(r.value)), 3)) {
          results.push({ metric, device_id: rows[a.index]?.device_id, value: a.value,
            zscore: Math.round(a.zscore * 100) / 100, timestamp: rows[a.index]?.recorded_at });
        }
      }
      return json({ model: "anomaly_detection", method: "z-score (statistique)", points_per_metric: counts,
        total_anomalies: results.length, anomalies: results,
        note: Object.values(counts).every((c) => c < MIN_POINTS) ? "Aucune mesure réelle suffisante : rien n'a pu être analysé." : undefined }, 200, req);
    }

    if (path === "/analyze/incidents" && req.method === "POST") {
      const r = await rest("/rest/v1/emergency_incidents?is_demo=eq.false&order=created_at.desc&limit=200&select=type,severity,status");
      const rows: any[] = Array.isArray(r.data) ? r.data : [];
      const tally = (k: string) => rows.reduce((m: Record<string, number>, x) => (m[x[k]] = (m[x[k]] ?? 0) + 1, m), {});
      return json({ model: "incident_summary", method: "comptage (non IA)", total_incidents: rows.length,
        by_type: tally("type"), by_severity: tally("severity"), by_status: tally("status"),
        note: rows.length === 0 ? "Aucun incident réel enregistré." : undefined }, 200, req);
    }

    if (path === "/predictions" && req.method === "GET") {
      const model = oneOf(url.searchParams.get("model"),
        ["traffic_forecast", "anomaly_detection", "energy_forecast", "waste_optimization", "incident_analysis", "report_classification"] as const);
      const r = await rest(`/rest/v1/ai_predictions?order=created_at.desc&limit=20${model ? `&model=eq.${model}` : ""}`);
      return json({ data: r.data }, 200, req);
    }
    return errorResponse("Route introuvable.", 404, req);
  } catch (err) {
    console.error("ai-service error:", (err as Error)?.message);
    return errorResponse("Erreur interne.", 500, req);
  }
}

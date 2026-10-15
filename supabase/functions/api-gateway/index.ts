import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  authenticate, errorResponse, isUuid, json, oneOf, preflight, readJson, requireConfig,
  requireRole, rest, STAFF_ROLES,
} from "../_shared/http.ts";

// Server-side API for the report workflow. The service role bypasses RLS, so EVERY branch below
// checks the caller's role itself and never trusts identity fields coming from the request body.

const CATEGORIES = ["traffic", "waste", "lighting", "water", "power", "security", "road", "other"] as const;
const STATUSES = ["pending", "validated", "assigned", "in_progress", "resolved", "rejected"] as const;
const PRIORITIES = ["low", "medium", "high", "critical"] as const;

const WORKFLOW: Record<string, string[]> = {
  pending: ["validated", "rejected"],
  validated: ["assigned", "rejected"],
  assigned: ["in_progress"],
  in_progress: ["resolved"],
  resolved: [],
  rejected: [],
};
// Who may perform a transition.
const TRANSITION_ROLES: Record<string, string[]> = {
  validated: ["admin", "government", "ministry", "province", "commune"],
  rejected: ["admin", "government", "ministry", "province", "commune"],
  assigned: ["admin", "government", "ministry", "province", "commune"],
  in_progress: ["admin", "agent", "commune", "province"],
  resolved: ["admin", "agent", "commune", "province"],
};

const REPORT_SELECT =
  "select=*,reporter:profiles!reporter_id(full_name),assigned_agent:profiles!assigned_to(full_name),commune:communes(name),province:provinces(name)";

function validCoords(lat: unknown, lng: unknown): lat is number {
  return typeof lat === "number" && typeof lng === "number" && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  const cfg = requireConfig(req);
  if (cfg) return cfg;

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/(functions\/v1\/)?api-gateway/, "");
    const method = req.method;

    if (path === "/health" && method === "GET") {
      return json({ status: "ok", timestamp: new Date().toISOString() }, 200, req);
    }

    const auth = await authenticate(req);
    if ("error" in auth) return auth.error;
    const { user, role } = auth;
    const isStaff = requireRole(role, STAFF_ROLES);

    // ---- GET /reports --------------------------------------------------------
    if (path === "/reports" && method === "GET") {
      let query = `/rest/v1/reports?${REPORT_SELECT}&order=created_at.desc&limit=50`;
      const status = oneOf(url.searchParams.get("status"), STATUSES);
      const category = oneOf(url.searchParams.get("category"), CATEGORIES);
      const priority = oneOf(url.searchParams.get("priority"), PRIORITIES);
      if (status) query += `&status=eq.${status}`;
      if (category) query += `&category=eq.${category}`;
      if (priority) query += `&priority=eq.${priority}`;
      const q = url.searchParams.get("q");
      if (q) query += `&title=ilike.${encodeURIComponent(`%${q.slice(0, 80).replace(/[%*,()]/g, " ")}%`)}`;
      if (!isStaff) query += `&reporter_id=eq.${user.id}`; // citizens: own reports only
      else if (url.searchParams.get("include_demo") !== "true") query += "&is_demo=eq.false";
      const res = await rest(query);
      if (!res.ok) return errorResponse("Lecture impossible.", 500, req);
      return json({ data: res.data, count: res.data.length }, 200, req);
    }

    // ---- GET /reports/:id ----------------------------------------------------
    const idMatch = path.match(/^\/reports\/([0-9a-f-]{36})$/i);
    if (idMatch && method === "GET") {
      if (!isUuid(idMatch[1])) return errorResponse("Identifiant invalide.", 400, req);
      let query = `/rest/v1/reports?id=eq.${idMatch[1]}&${REPORT_SELECT}`;
      if (!isStaff) query += `&reporter_id=eq.${user.id}`;
      const res = await rest(query);
      if (!Array.isArray(res.data) || res.data.length === 0) return errorResponse("Signalement introuvable.", 404, req);
      const ev = await rest(`/rest/v1/report_events?report_id=eq.${idMatch[1]}&order=created_at.asc&select=event_type,from_status,to_status,comment,created_at`);
      return json({ data: res.data[0], history: ev.data ?? [] }, 200, req);
    }

    // ---- POST /reports -------------------------------------------------------
    if (path === "/reports" && method === "POST") {
      const parsed = await readJson(req, 16_384);
      if (!parsed.ok) return parsed.res;
      const b = parsed.body;
      const category = oneOf(b.category, CATEGORIES);
      const priority = oneOf(b.priority ?? "medium", PRIORITIES);
      const title = typeof b.title === "string" ? b.title.trim() : "";
      const description = typeof b.description === "string" ? b.description.trim() : "";
      if (!category || !priority) return errorResponse("Catégorie ou priorité invalide.", 422, req);
      if (title.length < 3 || title.length > 200) return errorResponse("Titre : 3 à 200 caractères.", 422, req);
      if (description.length < 10 || description.length > 4000) return errorResponse("Description : 10 à 4000 caractères.", 422, req);

      const row: Record<string, unknown> = {
        category, title, description, priority,
        status: "pending",
        reporter_id: user.id, // never taken from the body
      };
      if (b.lat !== undefined || b.lng !== undefined) {
        if (!validCoords(b.lat, b.lng)) return errorResponse("Coordonnées GPS invalides.", 422, req);
        row.location = `SRID=4326;POINT(${b.lng} ${b.lat})`;
      }
      if (typeof b.address === "string") row.address = b.address.slice(0, 300);
      if (isUuid(b.commune_id)) row.commune_id = b.commune_id;
      if (isUuid(b.province_id)) row.province_id = b.province_id;

      const res = await rest("/rest/v1/reports", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) });
      if (!res.ok) return errorResponse("Création impossible.", 500, req);
      // The 'created' event is written by a database trigger (migration 022); nothing to forge here.
      return json({ data: res.data[0] }, 201, req);
    }

    // ---- PUT /reports/:id ----------------------------------------------------
    if (idMatch && method === "PUT") {
      if (!isStaff) return errorResponse("Réservé au personnel.", 403, req);
      const parsed = await readJson(req, 8_192);
      if (!parsed.ok) return parsed.res;
      const b = parsed.body;

      const cur = await rest(`/rest/v1/reports?id=eq.${idMatch[1]}&select=id,status,reporter_id,title,reference`);
      const report = Array.isArray(cur.data) ? cur.data[0] : null;
      if (!report) return errorResponse("Signalement introuvable.", 404, req);

      const updates: Record<string, unknown> = {};
      if (typeof b.title === "string" && b.title.trim().length >= 3) updates.title = b.title.trim().slice(0, 200);
      if (typeof b.description === "string" && b.description.trim().length >= 10) updates.description = b.description.trim().slice(0, 4000);
      const prio = oneOf(b.priority ?? null, PRIORITIES);
      if (prio) updates.priority = prio;

      const next = oneOf(b.status ?? null, STATUSES);
      if (b.status !== undefined && !next) return errorResponse("Statut invalide.", 422, req);
      if (next && next !== report.status) {
        if (!(WORKFLOW[report.status] ?? []).includes(next)) {
          return errorResponse(`Transition interdite : ${report.status} → ${next}.`, 422, req);
        }
        if (!requireRole(role, TRANSITION_ROLES[next] ?? [])) {
          return errorResponse("Votre rôle ne permet pas cette transition.", 403, req);
        }
        updates.status = next;
        if (next === "validated") updates.validated_by = user.id;
        if (next === "resolved") updates.resolved_at = new Date().toISOString();
        if (next === "assigned") {
          if (!isUuid(b.assigned_to)) return errorResponse("assigned_to (agent) requis.", 422, req);
          const ag = await rest(`/rest/v1/profiles?id=eq.${b.assigned_to}&role=in.(agent,commune,province)&is_active=eq.true&select=id`);
          if (!Array.isArray(ag.data) || ag.data.length === 0) return errorResponse("Agent introuvable ou inactif.", 422, req);
          updates.assigned_to = b.assigned_to;
        }
      }
      if (Object.keys(updates).length === 0) return errorResponse("Aucune modification valide.", 422, req);

      const res = await rest(`/rest/v1/reports?id=eq.${idMatch[1]}`, {
        method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(updates),
      });
      if (!res.ok) return errorResponse("Mise à jour impossible.", 500, req);

      if (updates.status) {
        // Audit trail: actor is the authenticated user, never a body field.
        await rest("/rest/v1/report_events", {
          method: "POST",
          body: JSON.stringify({
            report_id: report.id, event_type: updates.status, from_status: report.status,
            to_status: updates.status, actor_id: user.id,
            comment: typeof b.comment === "string" ? b.comment.slice(0, 500) : null,
          }),
        });
        await rest("/rest/v1/notifications", {
          method: "POST",
          body: JSON.stringify({
            user_id: report.reporter_id, title: "Mise à jour de votre signalement",
            message: `Votre signalement ${report.reference} est passé au statut « ${updates.status} ».`,
            type: updates.status === "resolved" ? "success" : "info", category: "Signalement",
          }),
        });
        if (updates.status === "assigned") {
          await rest("/rest/v1/interventions", {
            method: "POST",
            body: JSON.stringify({ report_id: report.id, agent_id: updates.assigned_to, status: "assigned" }),
          });
        }
      }
      return json({ data: res.data[0] }, 200, req);
    }

    // ---- DELETE /reports/:id -------------------------------------------------
    if (idMatch && method === "DELETE") {
      if (!requireRole(role, ["admin"])) return errorResponse("Réservé aux administrateurs.", 403, req);
      const res = await rest(`/rest/v1/reports?id=eq.${idMatch[1]}`, { method: "DELETE" });
      if (!res.ok) return errorResponse("Suppression impossible.", 500, req);
      await rest("/rest/v1/audit_log", {
        method: "POST",
        body: JSON.stringify({ actor_id: user.id, action: "report.delete", entity_type: "report", entity_id: idMatch[1] }),
      });
      return json({ success: true }, 200, req);
    }

    // ---- GET /stats ----------------------------------------------------------
    if (path === "/stats" && method === "GET") {
      if (!isStaff) return errorResponse("Réservé au personnel.", 403, req);
      const includeDemo = url.searchParams.get("include_demo") === "true";
      const res = await rest(`/rest/v1/reports?select=status,category,priority,is_demo${includeDemo ? "" : "&is_demo=eq.false"}`);
      const all: any[] = Array.isArray(res.data) ? res.data : [];
      const tally = (k: string) => all.reduce((m: Record<string, number>, r) => (m[r[k]] = (m[r[k]] ?? 0) + 1, m), {});
      const resolved = all.filter((r) => r.status === "resolved").length;
      return json({
        total: all.length, resolved,
        resolution_rate: all.length ? Math.round((resolved / all.length) * 100) : null,
        by_status: tally("status"), by_category: tally("category"), by_priority: tally("priority"),
        includes_demo_data: includeDemo,
      }, 200, req);
    }

    // ---- GET /gis-points -----------------------------------------------------
    if (path === "/gis-points" && method === "GET") {
      const geo = await rest("/rest/v1/rpc/get_gis_points_with_coords", { method: "POST", body: "{}" });
      if (!geo.ok) return errorResponse("Lecture cartographique impossible.", 500, req);
      return json({ data: geo.data }, 200, req);
    }

    // ---- notifications -------------------------------------------------------
    if (path === "/notifications" && method === "GET") {
      const res = await rest(`/rest/v1/notifications?user_id=eq.${user.id}&order=created_at.desc&limit=100`);
      return json({ data: res.data }, 200, req);
    }
    const nm = path.match(/^\/notifications\/([0-9a-f-]{36})\/read$/i);
    if (nm && method === "PUT") {
      const res = await rest(`/rest/v1/notifications?id=eq.${nm[1]}&user_id=eq.${user.id}`, {
        method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ read: true }),
      });
      if (!Array.isArray(res.data) || res.data.length === 0) return errorResponse("Notification introuvable.", 404, req);
      return json({ success: true }, 200, req);
    }

    // ---- GET /emergency ------------------------------------------------------
    if (path === "/emergency" && method === "GET") {
      if (!isStaff) return errorResponse("Réservé au personnel.", 403, req);
      let query = "/rest/v1/emergency_incidents?select=*&order=created_at.desc&limit=200";
      const st = url.searchParams.get("status");
      if (st && /^[a-z_]{3,20}$/.test(st)) query += `&status=eq.${st}`;
      if (url.searchParams.get("include_demo") !== "true") query += "&is_demo=eq.false";
      const res = await rest(query);
      return json({ data: res.data }, 200, req);
    }

    // ---- reference data ------------------------------------------------------
    if (path === "/provinces" && method === "GET") {
      const res = await rest("/rest/v1/provinces?select=*&order=name.asc");
      return json({ data: res.data }, 200, req);
    }
    if (path === "/communes" && method === "GET") {
      let query = "/rest/v1/communes?select=*&order=name.asc";
      const pid = url.searchParams.get("province_id");
      if (pid) {
        if (!isUuid(pid)) return errorResponse("province_id invalide.", 400, req);
        query += `&province_id=eq.${pid}`;
      }
      const res = await rest(query);
      return json({ data: res.data }, 200, req);
    }

    const pm = path.match(/^\/profile\/([0-9a-f-]{36})$/i);
    if (pm && method === "GET") {
      if (pm[1] !== user.id && !requireRole(role, ["admin"])) return errorResponse("Accès refusé.", 403, req);
      const res = await rest(`/rest/v1/profiles?id=eq.${pm[1]}&select=id,full_name,phone,role,province_id,commune_id,is_active,created_at`);
      if (!Array.isArray(res.data) || res.data.length === 0) return errorResponse("Profil introuvable.", 404, req);
      return json({ data: res.data[0] }, 200, req);
    }

    return errorResponse("Route introuvable.", 404, req);
  } catch (err) {
    console.error("api-gateway error:", (err as Error)?.message);
    return errorResponse("Erreur interne.", 500, req);
  }
});

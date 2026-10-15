import { authenticate, errorResponse, isUuid, json, preflight, rateLimit, readJson, requireConfig, rest, serviceKey, supabaseUrl } from "../_shared/http.ts";
import { sniffImage } from "../_shared/sniff.ts";

// POST { report_id } — le PROPRIÉTAIRE du signalement demande la vérification de ses pièces non vérifiées.
// Pour chaque pièce : téléchargement (clé service) → type réel par octets → doit égaler mime_type déclaré et taille ≤ 5 Mo.
//   conforme     → verified = true
//   non conforme → fichier supprimé du Storage ET ligne supprimée (rien n'est conservé)
const MAX_BYTES = 5 * 1024 * 1024;

export async function handle(req: Request): Promise<Response> {
  const pre = preflight(req); if (pre) return pre;
  const cfg = requireConfig(req); if (cfg) return cfg;
  if (req.method !== "POST") return errorResponse("Méthode non autorisée.", 405, req);
  try {
    const auth = await authenticate(req);
    if ("error" in auth) return auth.error;
    const body = await readJson(req, 2048);
    if (!body.ok) return body.res;
    const { report_id } = body.body;
    if (!isUuid(report_id)) return errorResponse("report_id (uuid) requis.", 400, req);
    if (!(await rateLimit(`verify-att:${auth.user.id}`, 60, 3600, { failOpen: false }))) {
      return errorResponse("Quota atteint.", 429, req);
    }
    // Propriété vérifiée côté serveur : seul le déclarant peut déclencher la vérification de ses fichiers.
    const own = await rest(`/rest/v1/reports?id=eq.${report_id}&reporter_id=eq.${auth.user.id}&select=id`);
    if (!Array.isArray(own.data) || own.data.length === 0) return errorResponse("Signalement introuvable.", 404, req);

    const r = await rest(`/rest/v1/report_attachments?report_id=eq.${report_id}&verified=eq.false&select=id,storage_path,mime_type,size_bytes`);
    const rows: any[] = Array.isArray(r.data) ? r.data : [];
    const out = { verified: 0, rejected: 0, errors: 0 };
    for (const row of rows) {
      let ok = false, transient = false;
      try {
        const path = String(row.storage_path).split("/").map(encodeURIComponent).join("/");
        const res = await fetch(`${supabaseUrl}/storage/v1/object/report-attachments/${path}`, {
          headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
        });
        if (res.status >= 500) transient = true;
        else if (res.ok) {
          const bytes = new Uint8Array(await res.arrayBuffer());
          ok = bytes.length > 0 && bytes.length <= MAX_BYTES && sniffImage(bytes) === row.mime_type;
        }
      } catch { transient = true; }
      if (transient) { out.errors++; continue; } // on réessaiera : ni validé ni supprimé
      if (ok) {
        const u = await rest(`/rest/v1/report_attachments?id=eq.${row.id}`, {
          method: "PATCH", body: JSON.stringify({ verified: true, verified_at: new Date().toISOString() }),
        });
        u.ok ? out.verified++ : out.errors++;
      } else {
        await fetch(`${supabaseUrl}/storage/v1/object/report-attachments`, {
          method: "DELETE", headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" },
          body: JSON.stringify({ prefixes: [row.storage_path] }),
        }).catch(() => {});
        await rest(`/rest/v1/report_attachments?id=eq.${row.id}`, { method: "DELETE" });
        out.rejected++;
      }
    }
    return json(out, 200, req);
  } catch (e) {
    console.error("verify-attachments error:", (e as Error)?.message);
    return errorResponse("Erreur interne.", 500, req);
  }
}

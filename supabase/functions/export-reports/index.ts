import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  authenticate, corsHeaders, errorResponse, json, oneOf, preflight, requireConfig, requireRole, rest,
} from "../_shared/http.ts";

const CATEGORIES = ["traffic", "waste", "lighting", "water", "power", "security", "road", "other"] as const;
const STATUSES = ["pending", "validated", "assigned", "in_progress", "resolved", "rejected"] as const;

// Neutralise spreadsheet formula injection (=, +, -, @, tab, CR at the start of a cell).
function cell(val: unknown): string {
  if (val === null || val === undefined) return "";
  let s = typeof val === "object" ? JSON.stringify(val) : String(val);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const keys = Object.keys(rows[0]);
  return "\uFEFF" + [keys.join(","), ...rows.map((r) => keys.map((k) => cell(r[k])).join(","))].join("\r\n");
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  const cfg = requireConfig(req);
  if (cfg) return cfg;
  try {
    const auth = await authenticate(req);
    if ("error" in auth) return auth.error;
    if (!requireRole(auth.role, ["admin", "government", "ministry"])) {
      return errorResponse("Export réservé aux rôles admin, gouvernement et ministère.", 403, req);
    }
    const url = new URL(req.url);
    const format = oneOf(url.searchParams.get("format") ?? "json", ["json", "csv"] as const);
    if (!format) return errorResponse("Format non pris en charge (json ou csv).", 400, req);

    let query = "/rest/v1/reports?select=id,reference,category,title,status,priority,address,created_at,resolved_at,is_demo&order=created_at.desc&limit=1000";
    const status = oneOf(url.searchParams.get("status"), STATUSES);
    const category = oneOf(url.searchParams.get("category"), CATEGORIES);
    if (status) query += `&status=eq.${status}`;
    if (category) query += `&category=eq.${category}`;
    if (url.searchParams.get("include_demo") !== "true") query += "&is_demo=eq.false";

    const res = await rest(query);
    if (!res.ok) return errorResponse("Lecture impossible.", 500, req);
    const reports = Array.isArray(res.data) ? res.data : [];

    if (format === "csv") {
      return new Response(toCsv(reports), {
        headers: { ...corsHeaders(req), "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="signalements.csv"' },
      });
    }
    return json({ data: reports, count: reports.length, exported_at: new Date().toISOString() }, 200, req);
  } catch (err) {
    console.error("export-reports error:", (err as Error)?.message);
    return errorResponse("Erreur interne.", 500, req);
  }
});

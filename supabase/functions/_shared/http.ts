// Shared helpers for Supabase Edge Functions (Deno).
// Rules enforced here:
//  - CORS is closed by default: only origins listed in ALLOWED_ORIGINS are echoed back.
//    Set ALLOW_ANY_ORIGIN=true explicitly for local experiments (never in production).
//  - Secrets are read from the function environment and never logged or returned.
//  - Query-string values must be validated before being placed in a PostgREST URL.

export const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
export const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
export const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const ALLOW_ANY_ORIGIN = Deno.env.get("ALLOW_ANY_ORIGIN") === "true";

export type Role =
  | "admin" | "government" | "ministry" | "province" | "commune" | "police"
  | "emergency" | "water" | "energy" | "waste" | "transport" | "agent" | "citizen" | null;

export const STAFF_ROLES = ["admin", "government", "ministry", "province", "commune", "agent"];

export function corsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers.get("Origin") ?? "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Device-Id, X-Device-Key",
    "Vary": "Origin",
  };
  if (ALLOW_ANY_ORIGIN) headers["Access-Control-Allow-Origin"] = "*";
  else if (origin && ALLOWED_ORIGINS.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

export function json(data: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

export function errorResponse(msg: string, status: number, req?: Request): Response {
  return json({ error: msg }, status, req);
}

export function preflight(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  return null;
}

/** Fails fast (503) when the function is not configured, instead of faking a service. */
export function requireConfig(req: Request): Response | null {
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return errorResponse("Service non configuré : SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY manquants.", 503, req);
  }
  return null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

/** Only allow a value that is in a fixed list; prevents PostgREST filter injection. */
export function oneOf<T extends string>(v: string | null, allowed: readonly T[]): T | null {
  return v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

export function boundedInt(v: string | null, def: number, min: number, max: number): number {
  const n = Number.parseInt(v ?? "", 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

export async function readJson(req: Request, maxBytes = 16_384): Promise<{ ok: true; body: any } | { ok: false; res: Response }> {
  const text = await req.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    return { ok: false, res: errorResponse("Requête trop volumineuse.", 413, req) };
  }
  try {
    const body = text ? JSON.parse(text) : {};
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return { ok: false, res: errorResponse("Corps JSON invalide (objet attendu).", 400, req) };
    }
    return { ok: true, body };
  } catch {
    return { ok: false, res: errorResponse("JSON invalide.", 400, req) };
  }
}

/** PostgREST call with the service role. Only for server-side code paths that already checked permissions. */
export async function rest(path: string, options: RequestInit = {}): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

export async function authenticate(
  req: Request,
): Promise<{ user: { id: string; email?: string }; role: Role } | { error: Response }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: errorResponse("Non autorisé : jeton manquant.", 401, req) };
  }
  const token = authHeader.slice("Bearer ".length).trim();
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
  });
  if (!userRes.ok) return { error: errorResponse("Non autorisé : jeton invalide ou expiré.", 401, req) };
  const user = await userRes.json();
  if (!isUuid(user?.id)) return { error: errorResponse("Non autorisé.", 401, req) };

  const profileRes = await rest(`/rest/v1/profiles?id=eq.${user.id}&select=role,is_active`);
  const profile = Array.isArray(profileRes.data) ? profileRes.data[0] : null;
  if (!profile || profile.is_active === false) {
    return { error: errorResponse("Compte inactif ou profil introuvable.", 403, req) };
  }
  return { user, role: (profile.role ?? null) as Role };
}

export function requireRole(role: Role, allowed: string[]): boolean {
  return role !== null && allowed.includes(role);
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Server-side rate limiting backed by public.check_rate_limit (service role only).
 * failOpen (défaut true) : si le limiteur lui-même échoue, on laisse passer pour ne pas arrêter la plateforme.
 * Pour une route qui COÛTE de l'argent (appel d'un LLM payant), passer { failOpen: false } : sans limiteur, on refuse.
 */
export async function rateLimit(
  key: string, max: number, windowSeconds: number, opts: { failOpen?: boolean } = {},
): Promise<boolean> {
  const failOpen = opts.failOpen ?? true;
  try {
    const r = await rest("/rest/v1/rpc/check_rate_limit", {
      method: "POST",
      body: JSON.stringify({ p_key: key, p_max_requests: max, p_window_seconds: windowSeconds }),
    });
    if (!r.ok) return failOpen;
    const row = Array.isArray(r.data) ? r.data[0] : r.data;
    return row?.allowed !== false;
  } catch {
    return failOpen;
  }
}

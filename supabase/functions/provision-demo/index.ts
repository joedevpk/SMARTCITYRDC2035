import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authenticate, errorResponse, json, preflight, requireConfig, requireRole, rest as adminApi } from "../_shared/http.ts";

// Demo accounts are created ONLY when ALLOW_DEMO_PROVISIONING=true and ADMIN_SEED_PASSWORD is set
// (>= 16 chars). Nothing is created silently; no password is generated-and-lost or returned.
const ALLOW = Deno.env.get("ALLOW_DEMO_PROVISIONING") === "true";

const DEMO_ACCOUNTS = [
  { email: "admin@smartcity-rdc.cd", name: "Administrateur National", role: "admin", phone: "+243800000000" },
  { email: "government@smartcity-rdc.cd", name: "Bureau du Gouvernement", role: "government", phone: "+243800000001" },
  { email: "ministry@smartcity-rdc.cd", name: "Ministère du Numérique", role: "ministry", phone: "+243800000002" },
  { email: "province@smartcity-rdc.cd", name: "Gouverneur Kinshasa", role: "province", phone: "+243800000003" },
  { email: "commune@smartcity-rdc.cd", name: "Maire de Gombe", role: "commune", phone: "+243800000004" },
  { email: "agent@smartcity-rdc.cd", name: "Agent Terrain", role: "agent", phone: "+243800000005" },
  { email: "citizen@smartcity-rdc.cd", name: "Citoyen Congolais", role: "citizen", phone: "+243800000006" },
];

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  const cfg = requireConfig(req);
  if (cfg) return cfg;

  try {
    if (!ALLOW) {
      return errorResponse("Provisionnement de démonstration désactivé (ALLOW_DEMO_PROVISIONING != true).", 403, req);
    }
    const auth = await authenticate(req);
    if ("error" in auth) return auth.error;

    const { role } = auth;

    // Only admin can provision demo accounts
    if (!requireRole(role, ["admin"])) {
      return errorResponse("Forbidden: only admin can provision demo accounts", 403, req);
    }

    const seedPassword = Deno.env.get("ADMIN_SEED_PASSWORD") ?? "";
    if (seedPassword.length < 16) {
      return errorResponse("ADMIN_SEED_PASSWORD (16 caractères minimum) doit être défini dans les secrets.", 412, req);
    }

    // Get geo IDs
    const geoRes = await adminApi("/rest/v1/provinces?code=eq.KIN&select=id");
    const kinshasaId = geoRes.data?.[0]?.id;
    const communeRes = await adminApi("/rest/v1/communes?name=eq.Gombe&select=id");
    const gombeId = communeRes.data?.[0]?.id;

    // List all existing users
    const listRes = await adminApi("/auth/v1/admin/users?per_page=1000");
    const existingUsers: { id: string; email: string }[] = listRes.data?.users || [];

    const results: { email: string; status: string; error?: string }[] = [];

    for (const account of DEMO_ACCOUNTS) {
      try {
        let userId: string | undefined;
        const existing = existingUsers.find((u) => u.email === account.email);

        if (existing) {
          userId = existing.id;
          results.push({ email: account.email, status: "exists" });
        } else {
          // Create user via admin API
          const createRes = await adminApi("/auth/v1/admin/users", {
            method: "POST",
            body: JSON.stringify({
              email: account.email,
              password: seedPassword,
              email_confirm: true,
              user_metadata: { full_name: account.name },
            }),
          });

          if (!createRes.ok) {
            results.push({ email: account.email, status: "error", error: JSON.stringify(createRes.data) });
            continue;
          }
          userId = createRes.data?.id;
          results.push({ email: account.email, status: "created" });
        }

        if (!userId) continue;

        // Upsert profile via REST API
        const profileRes = await adminApi("/rest/v1/profiles", {
          method: "POST",
          headers: {
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify({
            id: userId,
            full_name: account.name,
            role: account.role,
            phone: account.phone,
            province_id: kinshasaId,
            commune_id: gombeId,
            is_active: true,
          }),
        });

        if (!profileRes.ok) {
          const r = results.find((x) => x.email === account.email);
          if (r) r.error = `profile: ${JSON.stringify(profileRes.data)}`;
        }
      } catch (err) {
        results.push({ email: account.email, status: "error", error: "échec" });
      }
    }

    return json({
      success: true,
      results,
      password_source: "env",
    }, 200, req);
  } catch (err) {
    console.error("provision-demo error:", (err as Error)?.message);
    return errorResponse("Erreur interne.", 500, req);
  }
});

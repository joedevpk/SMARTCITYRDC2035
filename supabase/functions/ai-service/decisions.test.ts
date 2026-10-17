// Tests de la validation humaine des suggestions Gemini (decisions.ts + routes de handler.ts).
// Exécution :  deno test --allow-env supabase/functions/ai-service/
//
// ⚠ Ces tests utilisent une base SIMULÉE : ils prouvent le contrôle d'accès, la validation des entrées, l'identité
//   transmise à la base, la correspondance des codes d'erreur et l'absence d'écriture directe sur `reports`.
//   Ils NE prouvent PAS le comportement de la fonction SQL (atomicité, concurrence, persistance) : voir
//   database/tests/test_ai_decisions.sql, à exécuter sur PostgreSQL.
import nodeAssert from "node:assert/strict";
const assert = (cond: unknown, msg?: string) => nodeAssert.ok(cond, msg);
const assertEquals = (actual: unknown, expected: unknown, msg?: string) => nodeAssert.deepStrictEqual(actual, expected, msg);

Deno.env.set("SUPABASE_URL", "http://supabase.test");
Deno.env.set("SUPABASE_ANON_KEY", "anon-test-key");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-test-key");
Deno.env.set("ALLOWED_ORIGINS", "http://localhost:3000");
const { handle } = await import("./handler.ts");

const KEY = "AIzaSyTEST-SECRET-KEY-0123456789";
const PRED_ID = "22222222-2222-4222-8222-222222222222";
const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const REQ_ID = "33333333-3333-4333-8333-333333333333";
const USERS: Record<string, { id: string; role: string | null; active: boolean }> = {
  "tok-admin": { id: "aaaaaaaa-0000-4000-8000-000000000001", role: "admin", active: true },
  "tok-agent": { id: "aaaaaaaa-0000-4000-8000-000000000002", role: "agent", active: true },
  "tok-commune": { id: "aaaaaaaa-0000-4000-8000-000000000003", role: "commune", active: true },
  "tok-citizen": { id: "aaaaaaaa-0000-4000-8000-000000000004", role: "citizen", active: true },
  "tok-police": { id: "aaaaaaaa-0000-4000-8000-000000000005", role: "police", active: true },
  "tok-inactive": { id: "aaaaaaaa-0000-4000-8000-000000000006", role: "admin", active: false },
  "tok-province": { id: "aaaaaaaa-0000-4000-8000-000000000007", role: "province", active: true },
};
const SUGGESTION = {
  category: "waste", priority: "medium", summary: "Déchets accumulés devant le marché.",
  facts: ["Tas d'ordures"], assumptions: ["Collecte manquée"], recommendation: "Planifier un ramassage.",
};
const REPORT = {
  id: REPORT_ID, reference: "RPT-0001", title: "Ordures au marché", category: "waste", priority: "critical",
  status: "pending", updated_at: "2026-10-16T09:30:00.123456+00:00", is_demo: false,
};

type Call = { url: string; init?: RequestInit };
const world = {
  calls: [] as Call[],
  limiter: "allow" as "allow" | "deny",
  prediction: null as any,
  report: null as any,
  decisionRows: [] as any[],
  decisionsTable: true,
  rpc: (_args: any): { status: number; body: unknown } => ({ status: 200, body: { ok: true, replayed: false, decision: { id: "d1" } } }),
  insertOk: true,
};
const J = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  world.calls.push({ url, init });
  const method = (init?.method ?? "GET").toUpperCase();
  if (url.startsWith("https://generativelanguage.googleapis.com/")) {
    return Promise.resolve(J({ candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(SUGGESTION) }] }, finishReason: "STOP" }] }));
  }
  if (!url.startsWith("http://supabase.test")) return Promise.reject(new Error(`réseau interdit en test: ${url}`));
  if (url.endsWith("/auth/v1/user")) {
    const token = String((init?.headers as Record<string, string>)?.Authorization ?? "").replace("Bearer ", "");
    const u = USERS[token];
    return Promise.resolve(u ? J({ id: u.id }) : J({ msg: "invalid" }, 401));
  }
  if (url.includes("/rest/v1/profiles?")) {
    const id = new URL(url).searchParams.get("id")!.replace("eq.", "");
    const u = Object.values(USERS).find((x) => x.id === id);
    if (url.includes("select=full_name")) return Promise.resolve(J(u ? [{ full_name: "Agent Test" }] : []));
    return Promise.resolve(J(u ? [{ role: u.role, is_active: u.active }] : []));
  }
  if (url.includes("/rpc/check_rate_limit")) return Promise.resolve(J([{ allowed: world.limiter === "allow", remaining: 1 }]));
  if (url.includes("/rpc/apply_ai_suggestion_decision")) {
    const out = world.rpc(JSON.parse(String(init?.body)));
    return Promise.resolve(J(out.body, out.status));
  }
  if (url.includes("/rest/v1/ai_suggestion_decisions")) {
    if (!world.decisionsTable) return Promise.resolve(J({ code: "PGRST205", message: "table absente" }, 404));
    return Promise.resolve(J(world.decisionRows));
  }
  if (url.includes("/rest/v1/ai_predictions") && method === "POST") {
    if (!world.insertOk) return Promise.resolve(J({ message: "constraint" }, 400));
    return Promise.resolve(init?.headers && (init.headers as Record<string, string>).Prefer === "return=representation"
      ? J([{ id: PRED_ID }], 201) : new Response(null, { status: 201 }));
  }
  if (url.includes("/rest/v1/ai_predictions?id=eq.")) return Promise.resolve(J(world.prediction ? [world.prediction] : []));
  if (url.includes("/rest/v1/report_attachments?")) return Promise.resolve(J([]));
  if (url.includes("/rest/v1/reports?id=eq.")) return Promise.resolve(J(world.report ? [world.report] : []));
  return Promise.reject(new Error(`route simulée manquante: ${method} ${url}`));
}) as typeof fetch;

function reset() {
  world.calls = []; world.limiter = "allow"; world.decisionRows = []; world.decisionsTable = true; world.insertOk = true;
  world.prediction = { id: PRED_ID, target_id: REPORT_ID, prediction: { ...SUGGESTION }, created_at: "2026-10-16T09:00:00Z",
    features: { provider: "gemini", model: "test-model-1", is_llm: true, images_analyzed: 0 } };
  world.report = { ...REPORT };
  world.rpc = () => ({ status: 200, body: { ok: true, replayed: false, decision: { id: "d1", decision: "accepted" } } });
  Deno.env.set("GEMINI_API_KEY", KEY);
  Deno.env.set("AI_MODEL", "test-model-1");
}
const rpcCalls = () => world.calls.filter((c) => c.url.includes("/rpc/apply_ai_suggestion_decision"));
const reportWrites = () => world.calls.filter((c) => /\/rest\/v1\/reports/.test(c.url) && (c.init?.method ?? "GET").toUpperCase() !== "GET");

async function call(path: string, opts: { method?: string; token?: string | null; body?: unknown; raw?: string } = {}) {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token !== null) headers.Authorization = `Bearer ${opts.token ?? "tok-agent"}`;
  const res = await handle(new Request(`http://fn.test/functions/v1/ai-service${path}`, {
    method, headers, body: method === "GET" ? undefined : (opts.raw ?? JSON.stringify(opts.body ?? {})),
  }));
  const text = await res.text();
  let data: any = null; try { data = JSON.parse(text); } catch { /* non JSON */ }
  return { status: res.status, data, text };
}
const EXPECTED = { category: "waste", priority: "critical", updated_at: REPORT.updated_at };
const accept = (over: Record<string, unknown> = {}, token?: string) => call(`/suggestions/${PRED_ID}/decision`, {
  method: "POST", token, body: { action: "accept", request_id: REQ_ID, expected: EXPECTED, apply_category: true, apply_priority: false, ...over },
});

// ------------------------------------------------------------------ accès
Deno.test("décision : sans jeton → 401, aucune écriture", async () => {
  reset();
  const r = await accept({}, null as any);
  assertEquals(r.status, 401);
  assertEquals(rpcCalls().length, 0);
});

Deno.test("décision : citoyen, police, compte inactif → refusés, base jamais appelée", async () => {
  for (const t of ["tok-citizen", "tok-police", "tok-inactive"]) {
    reset();
    const r = await accept({}, t);
    assertEquals(r.status, 403, t);
    assertEquals(rpcCalls().length, 0, t);
  }
});

Deno.test("lecture d'une suggestion et de l'historique : citoyen refusé", async () => {
  reset();
  assertEquals((await call(`/suggestions/${PRED_ID}`, { token: "tok-citizen" })).status, 403);
  assertEquals((await call("/decisions", { token: "tok-citizen" })).status, 403);
  assertEquals((await call(`/suggestions/${PRED_ID}`, { token: null })).status, 401);
});

// ------------------------------------------------------------------ validation des entrées
Deno.test("décision : entrées invalides → 4xx et aucun appel à la base", async () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    ["action inconnue", { action: "delete" }],
    ["request_id absent", { request_id: undefined }],
    ["request_id non uuid", { request_id: "abc" }],
    ["expected absent", { expected: undefined }],
    ["expected.category hors liste", { expected: { ...EXPECTED, category: "bogus" } }],
    ["expected.priority hors liste", { expected: { ...EXPECTED, priority: "urgent" } }],
    ["expected.updated_at invalide", { expected: { ...EXPECTED, updated_at: "hier" } }],
    ["expected.updated_at absent", { expected: { category: "waste", priority: "critical" } }],
    ["accept sans champs explicites", { apply_category: undefined, apply_priority: undefined }],
    ["accept avec champs non booléens", { apply_category: "true", apply_priority: 1 }],
    ["accept sans aucun champ coché", { apply_category: false, apply_priority: false }],
    ["confirm_priority_decrease non booléen", { confirm_priority_decrease: "oui" }],
    ["commentaire non texte", { comment: 42 }],
  ];
  for (const [label, over] of cases) {
    reset();
    const r = await accept(over);
    assert(r.status >= 400 && r.status < 500, `${label} → ${r.status}`);
    assertEquals(rpcCalls().length, 0, label);
  }
});

Deno.test("modification : catégorie/priorité hors liste autorisée → 422 sans appel base ; JSON cassé → 400 ; corps énorme → 413", async () => {
  for (const body of [{ category: "bogus", priority: "high" }, { category: "waste", priority: "urgent" }, { category: "waste" }, { priority: "low" }]) {
    reset();
    const r = await call(`/suggestions/${PRED_ID}/decision`, { method: "POST", body: { action: "modify", request_id: REQ_ID, expected: EXPECTED, ...body } });
    assertEquals(r.status, 422, JSON.stringify(body));
    assertEquals(rpcCalls().length, 0);
  }
  reset();
  assertEquals((await call(`/suggestions/${PRED_ID}/decision`, { method: "POST", raw: "{pas du json" })).status, 400);
  assertEquals((await call(`/suggestions/${PRED_ID}/decision`, { method: "POST", raw: JSON.stringify({ comment: "x".repeat(20000) }) })).status, 413);
  assertEquals(rpcCalls().length, 0);
});

// ------------------------------------------------------------------ cas nominaux
Deno.test("accepter : l'identité transmise à la base est celle du jeton (jamais celle du corps) ; valeurs de lecture transmises telles quelles", async () => {
  reset();
  const r = await accept({ actor_id: "evil", decided_by: "evil", user_id: "evil", p_actor_id: "evil", category: "security" }, "tok-province");
  assertEquals(r.status, 201);
  assertEquals(r.data.ok, true);
  assertEquals(rpcCalls().length, 1);
  const sent = JSON.parse(String(rpcCalls()[0].init?.body));
  assertEquals(sent.p_actor_id, USERS["tok-province"].id);
  assertEquals(sent.p_prediction_id, PRED_ID);
  assertEquals(sent.p_decision, "accepted");
  assertEquals(sent.p_apply_category, true);
  assertEquals(sent.p_apply_priority, false);
  assertEquals(sent.p_category, null, "en acceptation, aucune valeur du client ne remplace la suggestion stockée");
  assertEquals(sent.p_priority, null);
  assertEquals(sent.p_expected_updated_at, REPORT.updated_at, "précision microseconde conservée (pas de passage par Date)");
  assertEquals(sent.p_request_id, REQ_ID);
  assertEquals(sent.p_confirm_priority_decrease, false);
  assertEquals(reportWrites().length, 0, "aucune écriture directe sur reports depuis l'Edge Function");
});

Deno.test("modifier : valeurs choisies transmises, confirmation de baisse transmise seulement si booléen true", async () => {
  reset();
  const r = await call(`/suggestions/${PRED_ID}/decision`, { method: "POST", token: "tok-admin",
    body: { action: "modify", request_id: REQ_ID, expected: EXPECTED, category: "road", priority: "high", confirm_priority_decrease: true, comment: "  Vérifié sur place  " } });
  assertEquals(r.status, 201);
  const sent = JSON.parse(String(rpcCalls()[0].init?.body));
  assertEquals([sent.p_decision, sent.p_category, sent.p_priority, sent.p_confirm_priority_decrease, sent.p_comment], ["modified", "road", "high", true, "Vérifié sur place"]);
  assertEquals(reportWrites().length, 0);
});

Deno.test("rejeter : aucune valeur appliquée côté demande", async () => {
  reset();
  const r = await call(`/suggestions/${PRED_ID}/decision`, { method: "POST", body: { action: "reject", request_id: REQ_ID, expected: EXPECTED } });
  assertEquals(r.status, 201);
  const sent = JSON.parse(String(rpcCalls()[0].init?.body));
  assertEquals([sent.p_decision, sent.p_apply_category, sent.p_apply_priority, sent.p_category, sent.p_priority], ["rejected", false, false, null, null]);
  assertEquals(reportWrites().length, 0);
});

Deno.test("double soumission : même request_id renvoyé à la base à l'identique ; réponse « rejouée » → 200 sans second effet", async () => {
  reset();
  world.rpc = () => ({ status: 200, body: { ok: true, replayed: true, decision: { id: "d1" } } });
  const a = await accept(); const b = await accept();
  assertEquals([a.status, b.status], [200, 200]);
  assertEquals(a.data.replayed, true);
  const ids = rpcCalls().map((c) => JSON.parse(String(c.init?.body)).p_request_id);
  assertEquals(ids, [REQ_ID, REQ_ID]);
});

// ------------------------------------------------------------------ refus de la base → codes HTTP + messages
Deno.test("codes d'échec de la base : statut HTTP et message explicites, jamais de succès", async () => {
  const expectations: Array<[string, number]> = [
    ["forbidden", 403], ["priority_decrease_forbidden", 403], ["priority_decrease_unconfirmed", 422],
    ["report_changed", 409], ["already_decided", 409], ["request_id_conflict", 409],
    ["prediction_not_found", 404], ["report_not_found", 404], ["invalid_suggestion", 422],
    ["nothing_to_apply", 422], ["invalid_value", 422], ["not_modified", 422],
  ];
  for (const [code, status] of expectations) {
    reset();
    world.rpc = () => ({ status: 200, body: { ok: false, code, current: { category: "waste" } } });
    const r = await accept();
    assertEquals(r.status, status, code);
    assertEquals(r.data.error, code);
    assert(typeof r.data.message === "string" && r.data.message.length > 10, code);
    assert(r.data.ok !== true, code);
  }
});

Deno.test("priorité critique : la baisse refusée par la base (rôle ou confirmation) n'est jamais présentée comme appliquée", async () => {
  reset();
  world.rpc = () => ({ status: 200, body: { ok: false, code: "priority_decrease_forbidden" } });
  const r = await accept({ apply_priority: true }, "tok-agent");
  assertEquals(r.status, 403);
  assertEquals(reportWrites().length, 0);
});

Deno.test("erreurs backend : RPC en erreur → 502 « rien appliqué » ; réponse incohérente → 502 ; migration absente → 503 ; panne réseau → 500 sans succès", async () => {
  reset();
  world.rpc = () => ({ status: 500, body: { message: "boom" } });
  let r = await accept();
  assertEquals(r.status, 502);
  assertEquals(r.data.error, "decision_failed");
  assert(/Aucune modification/.test(r.data.message));

  reset();
  world.rpc = () => ({ status: 200, body: { pas: "le bon format" } });
  assertEquals((await accept()).status, 502);

  reset();
  world.rpc = () => ({ status: 404, body: { code: "PGRST202", message: "fonction absente" } });
  r = await accept();
  assertEquals(r.status, 503);
  assertEquals(r.data.error, "decisions_unavailable");

  reset();
  world.rpc = () => { throw new Error("réseau coupé"); };
  r = await accept();
  assertEquals(r.status, 500);
  assert(r.data.ok !== true);
});

Deno.test("quota : trop de décisions → 429, base jamais appelée", async () => {
  reset(); world.limiter = "deny";
  assertEquals((await accept()).status, 429);
  assertEquals(rpcCalls().length, 0);
});

// ------------------------------------------------------------------ lecture
Deno.test("lecture d'une suggestion : valeurs actuelles + suggestion + droits de baisse de priorité selon le rôle", async () => {
  for (const [token, can] of [["tok-admin", true], ["tok-province", true], ["tok-agent", false], ["tok-commune", false]] as const) {
    reset();
    const r = await call(`/suggestions/${PRED_ID}`, { token });
    assertEquals(r.status, 200, token);
    assertEquals(r.data.report.category, "waste");
    assertEquals(r.data.report.priority, "critical");
    assertEquals(r.data.report.updated_at, REPORT.updated_at);
    assertEquals(r.data.suggestion.priority, "medium");
    assertEquals(r.data.llm_model, "test-model-1");
    assertEquals(r.data.decision, null);
    assertEquals(r.data.decisions_enabled, true);
    assertEquals(r.data.allowed.can_lower_priority, can, token);
    assertEquals(r.data.allowed.categories.includes("waste"), true);
    assertEquals(r.data.allowed.priorities, ["low", "medium", "high", "critical"]);
    assert(!r.text.includes(KEY));
  }
});

Deno.test("lecture : après un rejet, la suggestion complète reste consultable avec la décision et son auteur", async () => {
  reset();
  world.decisionRows = [{ id: "d1", prediction_id: PRED_ID, decision: "rejected", decided_by: USERS["tok-agent"].id, decided_role: "agent",
    decided_at: "2026-10-16T10:00:00Z", previous_priority: "critical", final_priority: "critical" }];
  const r = await call(`/suggestions/${PRED_ID}`);
  assertEquals(r.status, 200);
  assertEquals(r.data.decision.decision, "rejected");
  assertEquals(r.data.decision.decided_by_name, "Agent Test");
  assertEquals(r.data.suggestion.summary, SUGGESTION.summary);
  assertEquals(r.data.suggestion.facts, SUGGESTION.facts);
});

Deno.test("lecture : suggestion inconnue → 404 ; suggestion stockée hors schéma → 422 (jamais présentée comme applicable) ; signalement supprimé → 404", async () => {
  reset(); world.prediction = null;
  assertEquals((await call(`/suggestions/${PRED_ID}`)).status, 404);
  reset(); world.prediction.prediction = { ...SUGGESTION, category: "bogus" };
  assertEquals((await call(`/suggestions/${PRED_ID}`)).status, 422);
  reset(); world.prediction.prediction = null;
  assertEquals((await call(`/suggestions/${PRED_ID}`)).status, 422);
  reset(); world.report = null;
  assertEquals((await call(`/suggestions/${PRED_ID}`)).status, 404);
  reset();
  assertEquals((await call("/suggestions/pas-un-uuid")).status, 404);
});

Deno.test("lecture : migration 026 absente → suggestion consultable, décisions désactivées (pas d'erreur 500)", async () => {
  reset(); world.decisionsTable = false;
  const r = await call(`/suggestions/${PRED_ID}`);
  assertEquals(r.status, 200);
  assertEquals(r.data.decisions_enabled, false);
  const l = await call("/decisions");
  assertEquals(l.status, 200);
  assertEquals(l.data, { data: [], enabled: false });
});

Deno.test("historique des décisions : personnel autorisé, liste renvoyée", async () => {
  reset(); world.decisionRows = [{ id: "d1", prediction_id: PRED_ID, decision: "accepted" }];
  const r = await call("/decisions", { token: "tok-commune" });
  assertEquals(r.status, 200);
  assertEquals(r.data.enabled, true);
  assertEquals(r.data.data.length, 1);
});

// ------------------------------------------------------------------ classification : identifiant de suggestion, aucune application automatique
Deno.test("classify : renvoie prediction_id (Prefer: return=representation) et n'écrit JAMAIS dans reports (la priorité critique n'est pas abaissée par l'IA)", async () => {
  reset();
  const r = await call("/classify-report", { method: "POST", token: "tok-agent", body: { report_id: REPORT_ID } });
  assertEquals(r.status, 200);
  assertEquals(r.data.prediction_id, PRED_ID);
  assertEquals(r.data.requires_human_review, true);
  assertEquals(reportWrites().length, 0);
  const ins = world.calls.find((c) => c.url.includes("/rest/v1/ai_predictions") && c.init?.method === "POST")!;
  assertEquals((ins.init!.headers as Record<string, string>).Prefer, "return=representation");
  assertEquals(rpcCalls().length, 0, "classer ne décide pas à la place de l'agent");
});

Deno.test("classify : suggestion non enregistrée → prediction_id null (donc non validable)", async () => {
  reset(); world.insertOk = false;
  const r = await call("/classify-report", { method: "POST", token: "tok-agent", body: { report_id: REPORT_ID } });
  assertEquals(r.status, 200);
  assertEquals(r.data.persisted, false);
  assertEquals(r.data.prediction_id, null);
});

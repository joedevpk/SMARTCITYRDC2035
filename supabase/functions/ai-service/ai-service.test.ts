// Tests de l'Edge Function ai-service — appels réseau SIMULÉS (aucun appel réel à Google ni à Supabase).
// Exécution :  deno test --allow-env supabase/functions/ai-service/
//
// ⚠ Ces tests prouvent la logique (format de requête, mapping d'erreurs, validation, droits, limites).
//   Ils ne prouvent PAS que Google accepte la requête avec votre clé/modèle : voir docs/GEMINI_SETUP.md §6
//   (test réel à effectuer une fois les secrets posés).
// Pas de dépendance réseau (jsr.io) : assertions via node:assert intégré à Deno.
import nodeAssert from "node:assert/strict";
const assert = (cond: unknown, msg?: string) => nodeAssert.ok(cond, msg);
const assertEquals = (actual: unknown, expected: unknown, msg?: string) => nodeAssert.deepStrictEqual(actual, expected, msg);
const assertStringIncludes = (actual: string, needle: string) =>
  nodeAssert.ok(String(actual).includes(needle), `« ${needle} » absent de « ${actual} »`);

Deno.env.set("SUPABASE_URL", "http://supabase.test");
Deno.env.set("SUPABASE_ANON_KEY", "anon-test-key");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-test-key");
Deno.env.set("ALLOWED_ORIGINS", "http://localhost:3000");
// Les modules lisent ces variables au chargement : on les fixe AVANT l'import dynamique.
const { handle } = await import("./handler.ts");

// ------------------------------------------------------------------ monde simulé
const KEY = "AIzaSyTEST-SECRET-KEY-0123456789";
const MODEL = "test-model-1";
const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const USERS: Record<string, { id: string; role: string | null; active: boolean }> = {
  "tok-admin": { id: "aaaaaaaa-0000-4000-8000-000000000001", role: "admin", active: true },
  "tok-agent": { id: "aaaaaaaa-0000-4000-8000-000000000002", role: "agent", active: true },
  "tok-commune": { id: "aaaaaaaa-0000-4000-8000-000000000003", role: "commune", active: true },
  "tok-citizen": { id: "aaaaaaaa-0000-4000-8000-000000000004", role: "citizen", active: true },
  "tok-police": { id: "aaaaaaaa-0000-4000-8000-000000000005", role: "police", active: true },
  "tok-inactive": { id: "aaaaaaaa-0000-4000-8000-000000000006", role: "admin", active: false },
};
const REPORT = {
  id: REPORT_ID, title: "Lampadaire en panne", description: "Le lampadaire devant le bâtiment A est éteint depuis 3 jours.",
  category: "other", priority: "medium", address: "Av. du Peuple, Gombe", created_at: "2026-10-01T00:00:00Z",
};
const GOOD_JSON = {
  category: "lighting", priority: "high", summary: "Lampadaire éteint depuis trois jours.",
  facts: ["Lampadaire éteint depuis 3 jours", "Av. du Peuple, Gombe"], assumptions: ["Panne électrique locale"],
  recommendation: "Envoyer une équipe d'éclairage public.",
};

type Call = { url: string; init?: RequestInit };
const world = {
  calls: [] as Call[],
  inserted: [] as any[],
  limiter: "allow" as "allow" | "deny" | "error",
  insertOk: true,
  reportFound: true,
  telemetry: [] as any[],
  attachments: [] as any[],
  storageStatus: 200,
  gemini: (_url: string, _init?: RequestInit): Promise<Response> => Promise.reject(new Error("gemini not stubbed")),
};

const J = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const geminiText = (text: string, finishReason = "STOP") =>
  J({ candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason }], usageMetadata: { totalTokenCount: 10 } });
const geminiError = (status: number, providerStatus: string, message: string, reason?: string) =>
  J({ error: { code: status, message, status: providerStatus, ...(reason ? { details: [{ "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason }] } : {}) } }, status);

const realFetch = globalThis.fetch;
globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  world.calls.push({ url, init });
  const method = (init?.method ?? "GET").toUpperCase();
  if (url.startsWith("https://generativelanguage.googleapis.com/")) return world.gemini(url, init);
  if (!url.startsWith("http://supabase.test")) return Promise.reject(new Error(`réseau interdit en test: ${url}`));

  if (url.endsWith("/auth/v1/user")) {
    const token = String((init?.headers as Record<string, string>)?.Authorization ?? "").replace("Bearer ", "");
    const u = USERS[token];
    return Promise.resolve(u ? J({ id: u.id, email: `${u.role}@test` }) : J({ msg: "invalid" }, 401));
  }
  if (url.includes("/rest/v1/profiles?")) {
    const id = new URL(url).searchParams.get("id")!.replace("eq.", "");
    const u = Object.values(USERS).find((x) => x.id === id);
    return Promise.resolve(J(u ? [{ role: u.role, is_active: u.active }] : []));
  }
  if (url.includes("/rpc/check_rate_limit")) {
    if (world.limiter === "error") return Promise.resolve(J({ message: "boom" }, 500));
    return Promise.resolve(J([{ allowed: world.limiter === "allow", remaining: 1 }]));
  }
  if (url.includes("/rest/v1/report_attachments?")) return Promise.resolve(J(world.attachments));
  if (url.includes("/storage/v1/object/report-attachments/")) {
    return Promise.resolve(world.storageStatus === 200
      ? new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]), { status: 200 })
      : J({ message: "not found" }, world.storageStatus));
  }
  if (url.includes("/rest/v1/reports?id=eq.")) return Promise.resolve(J(world.reportFound ? [REPORT] : []));
  if (url.includes("/rest/v1/iot_telemetry?")) return Promise.resolve(J([...world.telemetry].reverse()));
  if (url.includes("/rest/v1/emergency_incidents")) {
    return Promise.resolve(J([{ type: "fire", severity: "high", status: "active" }, { type: "fire", severity: "low", status: "resolved" }]));
  }
  if (url.includes("/rest/v1/ai_predictions") && method === "POST") {
    world.inserted.push(JSON.parse(String(init?.body)));
    return Promise.resolve(world.insertOk ? new Response(null, { status: 201 }) : J({ message: "constraint" }, 400));
  }
  if (url.includes("/rest/v1/ai_predictions")) return Promise.resolve(J([{ id: "p1", model: "report_classification" }]));
  return Promise.reject(new Error(`route simulée manquante: ${method} ${url}`));
}) as typeof fetch;

function reset() {
  world.calls = []; world.inserted = []; world.limiter = "allow"; world.insertOk = true; world.reportFound = true;
  world.telemetry = []; world.attachments = []; world.storageStatus = 200;
  world.gemini = () => Promise.reject(new Error("gemini not stubbed"));
  Deno.env.set("GEMINI_API_KEY", KEY);
  Deno.env.set("AI_MODEL", MODEL);
  Deno.env.delete("AI_TIMEOUT_MS");
}
const geminiCalls = () => world.calls.filter((c) => c.url.startsWith("https://generativelanguage.googleapis.com/"));

async function call(path: string, opts: { method?: string; token?: string | null; body?: unknown } = {}) {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token !== null) headers.Authorization = `Bearer ${opts.token ?? "tok-agent"}`;
  const res = await handle(new Request(`http://fn.test/functions/v1/ai-service${path}`, {
    method, headers, body: method === "GET" ? undefined : JSON.stringify(opts.body ?? {}),
  }));
  const text = await res.text();
  let data: any = null; try { data = JSON.parse(text); } catch { /* corps non JSON */ }
  return { status: res.status, data, text };
}
const classify = (token?: string) => call("/classify-report", { method: "POST", token, body: { report_id: REPORT_ID } });
const noSecretLeak = (r: { text: string }) => assert(!r.text.includes(KEY), "la clé API ne doit jamais apparaître dans une réponse");

// ------------------------------------------------------------------ A. configuration
Deno.test("status : sans clé ni modèle → non configuré, noms des secrets manquants uniquement", async () => {
  reset(); Deno.env.delete("GEMINI_API_KEY"); Deno.env.delete("AI_MODEL");
  const r = await call("/status");
  assertEquals(r.status, 200);
  assertEquals(r.data.llm_configured, false);
  assertEquals(r.data.provider, null);
  assertEquals(r.data.model, null);
  assertEquals(r.data.missing, ["GEMINI_API_KEY", "AI_MODEL"]);
});

Deno.test("status : clé présente mais modèle manquant → non configuré (AI_MODEL)", async () => {
  reset(); Deno.env.delete("AI_MODEL");
  const r = await call("/status");
  assertEquals(r.data.llm_configured, false);
  assertEquals(r.data.missing, ["AI_MODEL"]);
  noSecretLeak(r);
});

Deno.test("status : nom de modèle dangereux (injection de chemin) → invalide, jamais utilisé dans une URL", async () => {
  reset(); Deno.env.set("AI_MODEL", "../../v1/models/x?key=evil");
  const s = await call("/status");
  assertEquals(s.data.llm_configured, false);
  assertEquals(s.data.invalid, ["AI_MODEL"]);
  const c = await classify();
  assertEquals(c.status, 503);
  assertEquals(c.data.error, "ai_not_configured");
  assertEquals(geminiCalls().length, 0);
});

Deno.test("status : configuré → provider gemini + modèle ; préfixe « models/ » toléré ; aucun secret renvoyé", async () => {
  reset(); Deno.env.set("AI_MODEL", `models/${MODEL}`);
  const r = await call("/status");
  assertEquals(r.data.llm_configured, true);
  assertEquals(r.data.provider, "gemini");
  assertEquals(r.data.model, MODEL);
  assertEquals(r.data.min_points, 12);
  noSecretLeak(r);
});

Deno.test("classify : sans clé → 503 ai_not_configured, aucun appel Gemini, rien d'enregistré", async () => {
  reset(); Deno.env.delete("GEMINI_API_KEY");
  const r = await classify();
  assertEquals(r.status, 503);
  assertEquals(r.data.error, "ai_not_configured");
  assertStringIncludes(r.data.message, "GEMINI_API_KEY");
  assertEquals(geminiCalls().length, 0);
  assertEquals(world.inserted.length, 0);
});

Deno.test("classify : modèle manquant → 503 ai_not_configured (AI_MODEL)", async () => {
  reset(); Deno.env.delete("AI_MODEL");
  const r = await classify();
  assertEquals(r.status, 503);
  assertStringIncludes(r.data.message, "AI_MODEL");
  assertEquals(geminiCalls().length, 0);
});

// ------------------------------------------------------------------ B. appel réel (forme de la requête) + réponse correcte
Deno.test("classify : requête Gemini conforme (URL, x-goog-api-key en en-tête, JSON mode) et réponse correcte enregistrée", async () => {
  reset();
  world.gemini = () => Promise.resolve(geminiText(JSON.stringify(GOOD_JSON)));
  const r = await classify("tok-commune");
  assertEquals(r.status, 200);
  assertEquals(r.data.requires_human_review, true);
  assertEquals(r.data.provider, "gemini");
  assertEquals(r.data.llm_model, MODEL);
  assertEquals(r.data.persisted, true);
  assertEquals(r.data.suggestion.category, "lighting");
  assertEquals(r.data.suggestion.priority, "high");
  assertEquals(r.data.current, { category: "other", priority: "medium" });
  assertEquals(Object.keys(r.data.suggestion).sort(), ["assumptions", "category", "facts", "priority", "recommendation", "summary"]);
  noSecretLeak(r);

  const g = geminiCalls();
  assertEquals(g.length, 1);
  assertEquals(g[0].url, `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`);
  assert(!g[0].url.includes("key="), "la clé ne doit pas être dans l'URL");
  assertEquals((g[0].init!.headers as Record<string, string>)["x-goog-api-key"], KEY);
  assertEquals(g[0].init!.method, "POST");
  const body = JSON.parse(String(g[0].init!.body));
  assertEquals(body.generationConfig.responseMimeType, "application/json");
  assertEquals(body.contents[0].role, "user");
  // Le contenu citoyen est dans « contents » (donnée), jamais dans l'instruction système.
  assertStringIncludes(body.contents[0].parts[0].text, "Lampadaire en panne");
  assert(!body.systemInstruction.parts[0].text.includes("Lampadaire"));
  assertStringIncludes(body.systemInstruction.parts[0].text, "NON FIABLE");
  // Aucune identité du citoyen n'est envoyée au fournisseur.
  assert(!body.contents[0].parts[0].text.includes("reporter"));

  assertEquals(world.inserted.length, 1);
  assertEquals(world.inserted[0].model, "report_classification");
  assertEquals(world.inserted[0].target_id, REPORT_ID);
  // images_analyzed (0 = texte seul) est écrit par le handler depuis l'ajout de l'analyse d'images : assertion mise à jour.
  assertEquals(world.inserted[0].features, { provider: "gemini", model: MODEL, is_llm: true, requested_by: USERS["tok-commune"].id, images_analyzed: 0 });
});

Deno.test("classify : JSON entouré de ```json … ``` accepté ; parties « thought » ignorées", async () => {
  reset();
  world.gemini = () => Promise.resolve(J({ candidates: [{ finishReason: "STOP", content: { parts: [
    { text: "je réfléchis…", thought: true },
    { text: "```json\n" + JSON.stringify(GOOD_JSON) + "\n```" },
  ] } }] }));
  const r = await classify();
  assertEquals(r.status, 200);
  assertEquals(r.data.suggestion.summary, GOOD_JSON.summary);
});

Deno.test("classify : enregistrement impossible → la suggestion est rendue mais persisted=false", async () => {
  reset(); world.insertOk = false;
  world.gemini = () => Promise.resolve(geminiText(JSON.stringify(GOOD_JSON)));
  const r = await classify();
  assertEquals(r.status, 200);
  assertEquals(r.data.persisted, false);
});

// ------------------------------------------------------------------ C. erreurs du fournisseur
Deno.test("classify : clé invalide (HTTP 400 API_KEY_INVALID) → 502 ai_provider_auth, clé non divulguée", async () => {
  reset();
  world.gemini = () => Promise.resolve(geminiError(400, "INVALID_ARGUMENT", "API key not valid. Please pass a valid API key.", "API_KEY_INVALID"));
  const r = await classify();
  assertEquals(r.status, 502);
  assertEquals(r.data.error, "ai_provider_auth");
  assertEquals(world.inserted.length, 0);
  noSecretLeak(r);
});

Deno.test("classify : 403 PERMISSION_DENIED → ai_provider_auth", async () => {
  reset();
  world.gemini = () => Promise.resolve(geminiError(403, "PERMISSION_DENIED", "denied"));
  const r = await classify();
  assertEquals(r.status, 502);
  assertEquals(r.data.error, "ai_provider_auth");
});

Deno.test("classify : quota dépassé (429 RESOURCE_EXHAUSTED) → 429 ai_quota_exceeded", async () => {
  reset();
  world.gemini = () => Promise.resolve(geminiError(429, "RESOURCE_EXHAUSTED", "quota"));
  const r = await classify();
  assertEquals(r.status, 429);
  assertEquals(r.data.error, "ai_quota_exceeded");
  assertEquals(world.inserted.length, 0);
});

Deno.test("classify : modèle inexistant (404) → 502 ai_model_unavailable", async () => {
  reset();
  world.gemini = () => Promise.resolve(geminiError(404, "NOT_FOUND", "model not found"));
  const r = await classify();
  assertEquals(r.status, 502);
  assertEquals(r.data.error, "ai_model_unavailable");
});

Deno.test("classify : paramètre refusé (400 INVALID_ARGUMENT) → 502 ai_provider_rejected", async () => {
  reset();
  world.gemini = () => Promise.resolve(geminiError(400, "INVALID_ARGUMENT", "Unknown name responseMimeType"));
  const r = await classify();
  assertEquals(r.status, 502);
  assertEquals(r.data.error, "ai_provider_rejected");
});

Deno.test("classify : indisponibilité (503 UNAVAILABLE) → 503 ai_provider_unavailable", async () => {
  reset();
  world.gemini = () => Promise.resolve(geminiError(503, "UNAVAILABLE", "overloaded"));
  const r = await classify();
  assertEquals(r.status, 503);
  assertEquals(r.data.error, "ai_provider_unavailable");
});

Deno.test("classify : erreur réseau → 502 ai_provider_unreachable", async () => {
  reset();
  world.gemini = () => Promise.reject(new TypeError("error sending request"));
  const r = await classify();
  assertEquals(r.status, 502);
  assertEquals(r.data.error, "ai_provider_unreachable");
  assertEquals(world.inserted.length, 0);
});

Deno.test("classify : délai dépassé (AI_TIMEOUT_MS=1000) → 504 ai_provider_timeout", async () => {
  reset(); Deno.env.set("AI_TIMEOUT_MS", "1000");
  world.gemini = (_u, init) => new Promise((_res, rej) => {
    init!.signal!.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")));
  });
  const t0 = Date.now();
  const r = await classify();
  assertEquals(r.status, 504);
  assertEquals(r.data.error, "ai_provider_timeout");
  assert(Date.now() - t0 < 5000);
  assertEquals(world.inserted.length, 0);
});

// ------------------------------------------------------------------ D. réponses mal formées / incomplètes
Deno.test("classify : réponse HTTP de Gemini non JSON (HTML) → 502 ai_provider_unreadable", async () => {
  reset();
  world.gemini = () => Promise.resolve(new Response("<html>oops</html>", { status: 200 }));
  const r = await classify();
  assertEquals(r.status, 502);
  assertEquals(r.data.error, "ai_provider_unreadable");
});

Deno.test("classify : aucune candidate → 502 ai_empty_response ; texte vide → idem", async () => {
  reset();
  world.gemini = () => Promise.resolve(J({ candidates: [] }));
  assertEquals((await classify()).data.error, "ai_empty_response");
  world.gemini = () => Promise.resolve(geminiText("   "));
  assertEquals((await classify()).data.error, "ai_empty_response");
  assertEquals(world.inserted.length, 0);
});

Deno.test("classify : requête bloquée (promptFeedback.blockReason / finishReason SAFETY) → 422 ai_content_blocked", async () => {
  reset();
  world.gemini = () => Promise.resolve(J({ promptFeedback: { blockReason: "SAFETY" } }));
  const a = await classify();
  assertEquals(a.status, 422);
  assertEquals(a.data.error, "ai_content_blocked");
  world.gemini = () => Promise.resolve(J({ candidates: [{ finishReason: "SAFETY" }] }));
  assertEquals((await classify()).status, 422);
  assertEquals(world.inserted.length, 0);
});

Deno.test("classify : sortie du modèle non JSON ou JSON tronqué → 502 ai_invalid_model_output, rien d'enregistré", async () => {
  reset();
  for (const text of ["Voici ma réponse : catégorie éclairage", '{"category":"lighting","priority":"high","summary":"x"', "null", "[]", "42"]) {
    world.gemini = () => Promise.resolve(geminiText(text, text.startsWith("{") ? "MAX_TOKENS" : "STOP"));
    const r = await classify();
    assertEquals(r.status, 502, text);
    assertEquals(r.data.error, "ai_invalid_model_output", text);
  }
  assertEquals(world.inserted.length, 0);
});

Deno.test("classify : JSON incomplet ou hors schéma → 502 ai_invalid_model_output, rien d'enregistré", async () => {
  reset();
  const bad: Record<string, unknown>[] = [
    { ...GOOD_JSON, category: "weather" },                // catégorie non autorisée
    { ...GOOD_JSON, priority: "urgent" },                 // priorité non autorisée
    { ...GOOD_JSON, summary: undefined },                 // champ manquant
    { ...GOOD_JSON, summary: "   " },                     // vide
    { ...GOOD_JSON, facts: "texte" },                     // mauvais type
    { ...GOOD_JSON, facts: ["ok", 3] },                   // élément non texte
    { ...GOOD_JSON, assumptions: undefined },
    { ...GOOD_JSON, recommendation: undefined },
    { ...GOOD_JSON, recommendation: 12 },
  ];
  for (const b of bad) {
    world.gemini = () => Promise.resolve(geminiText(JSON.stringify(b)));
    const r = await classify();
    assertEquals(r.status, 502, JSON.stringify(b));
    assertEquals(r.data.error, "ai_invalid_model_output");
  }
  assertEquals(world.inserted.length, 0);
});

Deno.test("classify : toutes les catégories et priorités autorisées sont acceptées ; longueurs plafonnées", async () => {
  reset();
  for (const category of ["traffic", "waste", "lighting", "water", "power", "security", "road", "other"]) {
    for (const priority of ["low", "medium", "high", "critical"]) {
      world.gemini = () => Promise.resolve(geminiText(JSON.stringify({ ...GOOD_JSON, category, priority })));
      const r = await classify();
      assertEquals(r.status, 200);
      assertEquals([r.data.suggestion.category, r.data.suggestion.priority], [category, priority]);
    }
  }
  world.gemini = () => Promise.resolve(geminiText(JSON.stringify({
    ...GOOD_JSON, summary: "s".repeat(900), facts: Array(30).fill("f".repeat(500)), recommendation: "r".repeat(900), extra: "ignoré",
  })));
  const r = await classify();
  assertEquals(r.data.suggestion.summary.length, 300);
  assertEquals(r.data.suggestion.recommendation.length, 300);
  assertEquals(r.data.suggestion.facts.length, 10);
  assertEquals(r.data.suggestion.facts[0].length, 200);
  assert(!("extra" in r.data.suggestion));
});

// ------------------------------------------------------------------ E. droits d'accès, validation d'entrée, limitation
Deno.test("accès : sans jeton → 401 ; jeton invalide → 401 ; compte inactif → 403 ; aucun appel Gemini", async () => {
  reset();
  assertEquals((await call("/status", { token: null })).status, 401);
  assertEquals((await call("/status", { token: "nimporte-quoi" })).status, 401);
  assertEquals((await classify("tok-inactive")).status, 403);
  assertEquals(geminiCalls().length, 0);
});

Deno.test("accès : citoyen et rôles de service (police) refusés (403) sur TOUTES les routes — pas d'élargissement de droits", async () => {
  reset();
  const routes: [string, string][] = [
    ["GET", "/status"], ["POST", "/classify-report"], ["POST", "/predict/traffic"], ["POST", "/predict/energy"],
    ["POST", "/detect/anomalies"], ["POST", "/analyze/incidents"], ["GET", "/predictions"],
  ];
  for (const token of ["tok-citizen", "tok-police"]) {
    for (const [method, path] of routes) {
      const r = await call(path, { method, token, body: { report_id: REPORT_ID } });
      assertEquals(r.status, 403, `${token} ${method} ${path}`);
    }
  }
  assertEquals(geminiCalls().length, 0);
  assertEquals(world.inserted.length, 0);
});

Deno.test("accès : admin, agent et commune (personnel) autorisés", async () => {
  reset();
  for (const token of ["tok-admin", "tok-agent", "tok-commune"]) assertEquals((await call("/status", { token })).status, 200);
});

Deno.test("classify : report_id invalide → 400 ; corps invalide → 400 ; signalement introuvable → 404", async () => {
  reset();
  world.gemini = () => Promise.resolve(geminiText(JSON.stringify(GOOD_JSON)));
  assertEquals((await call("/classify-report", { method: "POST", body: { report_id: "pas-un-uuid" } })).status, 400);
  assertEquals((await call("/classify-report", { method: "POST", body: { report_id: "1; drop table reports" } })).status, 400);
  world.reportFound = false;
  assertEquals((await classify()).status, 404);
  assertEquals(geminiCalls().length, 0);
});

Deno.test("classify : quota utilisateur dépassé → 429 sans appel Gemini ; limiteur en panne → refus (fail-closed, route payante)", async () => {
  reset(); world.limiter = "deny";
  world.gemini = () => Promise.resolve(geminiText(JSON.stringify(GOOD_JSON)));
  assertEquals((await classify()).status, 429);
  world.limiter = "error";
  assertEquals((await classify()).status, 429);
  assertEquals(geminiCalls().length, 0);
});

Deno.test("méthodes/chemins : GET sur /classify-report → 404 ; route inconnue → 404", async () => {
  reset();
  assertEquals((await call("/classify-report", { method: "GET" })).status, 404);
  assertEquals((await call("/nope")).status, 404);
});

// ------------------------------------------------------------------ F. autres routes conservées (statistiques, non IA)
const series = (n: number, f: (i: number) => number) =>
  Array.from({ length: n }, (_, i) => ({ device_id: "d1", value: f(i), recorded_at: new Date(Date.UTC(2026, 9, 1, i)).toISOString() }));

Deno.test("predict/traffic : < 12 mesures réelles → 422 insufficient_real_data (aucune série fabriquée)", async () => {
  reset(); world.telemetry = series(5, (i) => i);
  const r = await call("/predict/traffic", { method: "POST", body: { hours: 3 } });
  assertEquals(r.status, 422);
  assertEquals(r.data.error, "insufficient_real_data");
  assertEquals(world.inserted.length, 0);
});

Deno.test("predict/traffic : 24 mesures → prévision statistique étiquetée « pas un modèle d'IA », enregistrée, sans appel Gemini", async () => {
  reset(); world.telemetry = series(24, (i) => 100 + 5 * i);
  const r = await call("/predict/traffic", { method: "POST", body: { hours: 3 } });
  assertEquals(r.status, 200);
  assertEquals(r.data.model, "traffic_forecast");
  assertStringIncludes(r.data.method, "pas un modèle d'IA");
  assertEquals(r.data.forecast.length, 3);
  assertEquals(r.data.forecast[0].hour, 1);
  assert(r.data.forecast[0].predicted_vehicles > 200);        // tendance croissante prolongée
  assertEquals(r.data.persisted, true);
  assertEquals(world.inserted[0].features.is_llm, false);
  assertEquals(world.inserted[0].features.provider, "statistics");
  assertEquals(geminiCalls().length, 0);
});

Deno.test("predict/energy : mêmes garanties (clé predicted_kw)", async () => {
  reset(); world.telemetry = series(20, (i) => 50 + (i % 3));
  const r = await call("/predict/energy", { method: "POST", body: {} });
  assertEquals(r.status, 200);
  assertEquals(r.data.model, "energy_forecast");
  assert("predicted_kw" in r.data.forecast[0]);
});

Deno.test("predict : quota dépassé → 429 ; limiteur en panne → la route statistique continue (fail-open, pas de coût)", async () => {
  reset(); world.telemetry = series(20, (i) => i); world.limiter = "deny";
  assertEquals((await call("/predict/traffic", { method: "POST" })).status, 429);
  world.limiter = "error";
  assertEquals((await call("/predict/traffic", { method: "POST" })).status, 200);
});

Deno.test("detect/anomalies : z-score statistique, détecte une valeur aberrante", async () => {
  reset(); world.telemetry = series(30, (i) => (i === 15 ? 5000 : 10));
  const r = await call("/detect/anomalies", { method: "POST" });
  assertEquals(r.status, 200);
  assertEquals(r.data.model, "anomaly_detection");
  assertStringIncludes(r.data.method, "statistique");
  assert(r.data.total_anomalies >= 1);
});

Deno.test("analyze/incidents : comptage (non IA)", async () => {
  reset();
  const r = await call("/analyze/incidents", { method: "POST" });
  assertEquals(r.status, 200);
  assertEquals(r.data.total_incidents, 2);
  assertEquals(r.data.by_type, { fire: 2 });
  assertStringIncludes(r.data.method, "non IA");
});

Deno.test("predictions : historique lisible par le personnel ; filtre model validé (liste blanche)", async () => {
  reset();
  const ok = await call("/predictions?model=report_classification");
  assertEquals(ok.status, 200);
  assertEquals(ok.data.data[0].id, "p1");
  const inj = await call("/predictions?model=x%26id%3Dneq.0");
  assertEquals(inj.status, 200);
  const last = world.calls.filter((c) => c.url.includes("/rest/v1/ai_predictions")).pop()!;
  assert(!last.url.includes("model=eq."), "un filtre non autorisé ne doit pas être transmis à PostgREST");
});

Deno.test("CORS : origine non listée → pas d'en-tête Allow-Origin ; preflight OPTIONS → 204", async () => {
  reset();
  const res = await handle(new Request("http://fn.test/functions/v1/ai-service/status", { method: "OPTIONS", headers: { Origin: "https://evil.example" } }));
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), null);
  const ok = await handle(new Request("http://fn.test/functions/v1/ai-service/status", { method: "OPTIONS", headers: { Origin: "http://localhost:3000" } }));
  assertEquals(ok.headers.get("Access-Control-Allow-Origin"), "http://localhost:3000");
});

Deno.test("aucun appel réseau réel n'a été fait (fetch simulé uniquement)", () => {
  assert(globalThis.fetch !== realFetch);
});

// ------------------------------------------------------------------ images jointes (multimodal)
const ATT = { storage_path: "aaaaaaaa-0000-4000-8000-000000000004/" + REPORT_ID + "/22222222-2222-4222-8222-222222222222.jpg", mime_type: "image/jpeg", size_bytes: 7 };

Deno.test("classify avec photo : l'image est RÉELLEMENT transmise à Gemini (inlineData) et comptée", async () => {
  reset(); world.attachments = [ATT];
  world.gemini = () => Promise.resolve(geminiText(JSON.stringify({ ...GOOD_JSON, observed_in_images: ["Poteau sans lumière visible"] })));
  const r = await classify();
  assertEquals(r.status, 200);
  const body = JSON.parse(String(geminiCalls()[0].init?.body));
  const parts = body.contents[0].parts;
  assertEquals(parts.length, 2);
  assertEquals(parts[1].inlineData.mimeType, "image/jpeg");
  assert(typeof parts[1].inlineData.data === "string" && parts[1].inlineData.data.length > 0);
  assertEquals(r.data.images, { registered: 1, analyzed: 1, failed: 0 });
  assertEquals(r.data.suggestion.observed_in_images, ["Poteau sans lumière visible"]);
  // l'accès au fichier privé se fait avec la clé service, côté serveur uniquement
  noSecretLeak(r);
});

Deno.test("classify sans photo : aucun champ observed_in_images (le modèle ne peut rien « voir »), images.analyzed = 0", async () => {
  reset();
  world.gemini = () => Promise.resolve(geminiText(JSON.stringify({ ...GOOD_JSON, observed_in_images: ["Invention"] })));
  const r = await classify();
  assertEquals(r.status, 200);
  assertEquals(JSON.parse(String(geminiCalls()[0].init?.body)).contents[0].parts.length, 1);
  assertEquals(r.data.images, { registered: 0, analyzed: 0, failed: 0 });
  assertEquals(r.data.suggestion.observed_in_images, undefined);
});

Deno.test("classify : photo illisible dans le stockage → analyse sur le texte seul, échec ANNONCÉ (jamais masqué)", async () => {
  reset(); world.attachments = [ATT]; world.storageStatus = 404;
  world.gemini = () => Promise.resolve(geminiText(JSON.stringify(GOOD_JSON)));
  const r = await classify();
  assertEquals(r.status, 200);
  assertEquals(r.data.images, { registered: 1, analyzed: 0, failed: 1 });
});

Deno.test("classify : fichier déclaré trop gros ou type non autorisé → jamais téléchargé ni transmis", async () => {
  reset(); world.attachments = [{ ...ATT, size_bytes: 6 * 1024 * 1024 }, { ...ATT, mime_type: "image/svg+xml" }];
  world.gemini = () => Promise.resolve(geminiText(JSON.stringify(GOOD_JSON)));
  const r = await classify();
  assertEquals(r.data.images, { registered: 2, analyzed: 0, failed: 2 });
  assertEquals(world.calls.filter((c) => c.url.includes("/storage/v1/")).length, 0);
});

Deno.test("classify : type déclaré ≠ octets réels (PNG annoncé, JPEG stocké) → image refusée, jamais transmise à Gemini", async () => {
  reset(); world.attachments = [{ ...ATT, mime_type: "image/png" }];
  world.gemini = () => Promise.resolve(geminiText(JSON.stringify(GOOD_JSON)));
  const r = await classify();
  assertEquals(r.data.images, { registered: 1, analyzed: 0, failed: 1 });
  assertEquals(JSON.parse(String(geminiCalls()[0].init?.body)).contents[0].parts.length, 1);
});

Deno.test("classify : seules les pièces vérifiées sont demandées à la base (verified=eq.true)", async () => {
  reset(); world.attachments = [ATT];
  world.gemini = () => Promise.resolve(geminiText(JSON.stringify(GOOD_JSON)));
  await classify();
  assert(world.calls.some((c) => c.url.includes("/report_attachments?") && c.url.includes("verified=eq.true")));
});

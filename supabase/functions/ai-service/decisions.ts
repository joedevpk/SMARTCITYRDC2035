import { errorResponse, isUuid, json, rateLimit, readJson, rest } from "../_shared/http.ts";
import { CATEGORIES, PRIORITIES, parseSuggestion } from "./gemini.ts";

// ---------------------------------------------------------------------------
// Validation humaine des suggestions de classification Gemini
//   GET  /suggestions/:predictionId           : suggestion + valeurs actuelles du signalement + décision éventuelle
//   POST /suggestions/:predictionId/decision  : accepter | modifier | rejeter
//   GET  /decisions                           : dernières décisions (personnel)
//
// Principes :
//  - l'appelant a DÉJÀ été authentifié et son rôle contrôlé comme membre du personnel (handler.ts) ;
//  - la suggestion appliquée vient TOUJOURS de la base (ai_predictions), jamais du corps de la requête ;
//  - la décision, la mise à jour du signalement, l'historique et l'audit sont écrits par UNE fonction SQL atomique
//    (public.apply_ai_suggestion_decision, migration 026) qui REFAIT les contrôles (rôle, baisse de priorité,
//    valeurs autorisées, modification concurrente, double soumission) ;
//  - la priorité « critical » n'est jamais abaissée automatiquement : une baisse exige un rôle habilité ET une
//    confirmation explicite (confirm_priority_decrease), vérifiés ici ET en SQL.
// ---------------------------------------------------------------------------

/** Rôles autorisés à BAISSER une priorité (doit rester identique à v_lower_roles dans la migration 026). */
export const LOWER_PRIORITY_ROLES = ["admin", "government", "ministry", "province"] as const;

const ACTIONS = { accept: "accepted", modify: "modified", reject: "rejected" } as const;
type Action = keyof typeof ACTIONS;

const ISO_TS = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)$/;

export interface DecisionInput {
  action: Action;
  request_id: string;
  expected: { category: string; priority: string; updated_at: string | null };
  apply_category: boolean;
  apply_priority: boolean;
  category: string | null;
  priority: string | null;
  confirm_priority_decrease: boolean;
  comment: string | null;
}

export type Validation =
  | { ok: true; value: DecisionInput }
  | { ok: false; status: number; code: string; message: string };

const bad = (message: string): Validation => ({ ok: false, status: 422, code: "invalid_input", message });
const isOneOf = <T extends string>(v: unknown, list: readonly T[]): v is T => typeof v === "string" && (list as readonly string[]).includes(v);

/** Valide le corps d'une décision. Aucune valeur par défaut « permissive » : les champs approuvés sont explicites. */
export function validateDecisionBody(b: any): Validation {
  if (!isOneOf(b?.action, Object.keys(ACTIONS) as Action[])) return bad("Action invalide (accept, modify ou reject).");
  const action = b.action as Action;
  if (!isUuid(b.request_id)) return bad("request_id (uuid) requis : il protège contre les doubles envois.");

  const e = b.expected;
  if (e === null || typeof e !== "object" || Array.isArray(e)) return bad("Valeurs de référence (expected) manquantes.");
  if (!isOneOf(e.category, CATEGORIES) || !isOneOf(e.priority, PRIORITIES)) return bad("Valeurs de référence (expected) invalides.");
  if (!("updated_at" in e) || !(e.updated_at === null || (typeof e.updated_at === "string" && ISO_TS.test(e.updated_at)))) {
    return bad("expected.updated_at invalide (horodatage ISO ou null).");
  }

  if (b.confirm_priority_decrease !== undefined && typeof b.confirm_priority_decrease !== "boolean") return bad("confirm_priority_decrease doit être booléen.");
  if (b.comment !== undefined && b.comment !== null && typeof b.comment !== "string") return bad("Commentaire invalide.");
  const comment = typeof b.comment === "string" ? b.comment.trim().slice(0, 500) || null : null;

  let apply_category = false, apply_priority = false, category: string | null = null, priority: string | null = null;
  if (action === "accept") {
    if (typeof b.apply_category !== "boolean" || typeof b.apply_priority !== "boolean") {
      return bad("Indiquez explicitement les champs à appliquer (apply_category, apply_priority).");
    }
    if (!b.apply_category && !b.apply_priority) return bad("Aucun champ sélectionné : utilisez « Rejeter » pour ne rien appliquer.");
    apply_category = b.apply_category; apply_priority = b.apply_priority;
  } else if (action === "modify") {
    if (!isOneOf(b.category, CATEGORIES)) return bad(`Catégorie non autorisée. Valeurs permises : ${CATEGORIES.join(", ")}.`);
    if (!isOneOf(b.priority, PRIORITIES)) return bad(`Priorité non autorisée. Valeurs permises : ${PRIORITIES.join(", ")}.`);
    category = b.category; priority = b.priority; apply_category = true; apply_priority = true;
  }
  return {
    ok: true,
    value: {
      action, request_id: b.request_id,
      expected: { category: e.category, priority: e.priority, updated_at: e.updated_at },
      apply_category, apply_priority, category, priority,
      confirm_priority_decrease: b.confirm_priority_decrease === true,
      comment,
    },
  };
}

/** Codes renvoyés par la fonction SQL → statut HTTP + message pour l'agent. */
export const DECISION_ERRORS: Record<string, { status: number; message: string }> = {
  invalid_decision: { status: 422, message: "Décision invalide." },
  forbidden: { status: 403, message: "Accès refusé : réservé au personnel autorisé." },
  request_id_conflict: { status: 409, message: "Cette requête a déjà été utilisée pour une autre suggestion." },
  prediction_not_found: { status: 404, message: "Suggestion introuvable." },
  already_decided: { status: 409, message: "Cette suggestion a déjà fait l'objet d'une décision." },
  report_not_found: { status: 404, message: "Le signalement n'existe plus. Aucune modification n'a été appliquée." },
  report_changed: { status: 409, message: "Le signalement a été modifié depuis votre lecture. Rechargez la suggestion avant de décider : rien n'a été appliqué." },
  invalid_suggestion: { status: 422, message: "La suggestion enregistrée est invalide (valeur non autorisée). Relancez l'analyse." },
  nothing_to_apply: { status: 422, message: "Aucun champ sélectionné : rien à appliquer." },
  invalid_value: { status: 422, message: "Catégorie ou priorité non autorisée." },
  not_modified: { status: 422, message: "Les valeurs sont identiques à la suggestion : utilisez « Accepter »." },
  priority_decrease_forbidden: { status: 403, message: "Votre rôle ne permet pas de baisser une priorité. Aucune modification n'a été appliquée." },
  priority_decrease_unconfirmed: { status: 422, message: "La baisse de priorité doit être confirmée explicitement." },
};

const MISSING_BACKEND = { status: 503, code: "decisions_unavailable",
  message: "La validation humaine n'est pas disponible : la migration 026 n'est pas appliquée sur la base. Aucune modification n'a été faite." };

/** PostgREST : fonction/table absente (migration non appliquée). */
function backendMissing(r: { ok: boolean; status: number; data: any }): boolean {
  if (r.ok) return false;
  const code = String(r.data?.code ?? "");
  return r.status === 404 || code === "PGRST202" || code === "PGRST205" || code === "42P01" || code === "42883";
}

const err = (req: Request, status: number, code: string, message: string) => json({ error: code, message }, status, req);

// ---------------------------------------------------------------- GET /suggestions/:id
export async function getSuggestion(req: Request, predictionId: string, role: string | null) {
  const p = await rest(`/rest/v1/ai_predictions?id=eq.${predictionId}&model=eq.report_classification&select=id,target_id,prediction,features,created_at`);
  const pred = Array.isArray(p.data) ? p.data[0] : null;
  if (!pred || !isUuid(pred.target_id)) return err(req, 404, "prediction_not_found", "Suggestion introuvable.");

  // La suggestion stockée est re-validée : une valeur hors schéma n'est jamais présentée comme applicable.
  const checked = parseSuggestion(JSON.stringify(pred.prediction ?? null), {
    imagesSent: Array.isArray(pred.prediction?.observed_in_images),
  });
  if (!checked.ok) return err(req, 422, "invalid_suggestion", DECISION_ERRORS.invalid_suggestion.message);

  const r = await rest(`/rest/v1/reports?id=eq.${pred.target_id}&select=id,reference,title,category,priority,status,updated_at,is_demo`);
  const report = Array.isArray(r.data) ? r.data[0] : null;
  if (!report) return err(req, 404, "report_not_found", DECISION_ERRORS.report_not_found.message);

  const d = await rest(`/rest/v1/ai_suggestion_decisions?prediction_id=eq.${predictionId}&select=*`);
  const decisionsEnabled = !backendMissing(d);
  const decision = decisionsEnabled && Array.isArray(d.data) ? (d.data[0] ?? null) : null;
  let decidedByName: string | null = null;
  if (decision && isUuid(decision.decided_by)) {
    const u = await rest(`/rest/v1/profiles?id=eq.${decision.decided_by}&select=full_name`);
    decidedByName = Array.isArray(u.data) && typeof u.data[0]?.full_name === "string" ? u.data[0].full_name : null;
  }

  return json({
    prediction_id: pred.id,
    created_at: pred.created_at,
    provider: pred.features?.provider ?? null,
    llm_model: typeof pred.features?.model === "string" ? pred.features.model : null,
    images_analyzed: Number.isFinite(pred.features?.images_analyzed) ? pred.features.images_analyzed : 0,
    suggestion: checked.suggestion,
    report,
    decision: decision ? { ...decision, decided_by_name: decidedByName } : null,
    decisions_enabled: decisionsEnabled,
    allowed: {
      categories: CATEGORIES,
      priorities: PRIORITIES,
      can_lower_priority: role !== null && (LOWER_PRIORITY_ROLES as readonly string[]).includes(role),
    },
  }, 200, req);
}

// ---------------------------------------------------------------- POST /suggestions/:id/decision
export async function decideSuggestion(req: Request, predictionId: string, userId: string, _role: string | null) {
  const parsed = await readJson(req, 8_192);
  if (!parsed.ok) return parsed.res;
  const v = validateDecisionBody(parsed.body);
  if (!v.ok) return err(req, v.status, v.code, v.message);
  const input = v.value;

  if (!(await rateLimit(`ai-decision:${userId}`, 60, 3600))) {
    return errorResponse("Quota atteint : 60 décisions par heure.", 429, req);
  }

  const r = await rest("/rest/v1/rpc/apply_ai_suggestion_decision", {
    method: "POST",
    body: JSON.stringify({
      p_prediction_id: predictionId,
      p_actor_id: userId,                      // identité vérifiée par authenticate(), jamais lue dans le corps
      p_decision: ACTIONS[input.action],
      p_apply_category: input.apply_category,
      p_apply_priority: input.apply_priority,
      p_category: input.category,
      p_priority: input.priority,
      p_confirm_priority_decrease: input.confirm_priority_decrease,
      p_expected_category: input.expected.category,
      p_expected_priority: input.expected.priority,
      p_expected_updated_at: input.expected.updated_at,
      p_comment: input.comment,
      p_request_id: input.request_id,
    }),
  });

  if (backendMissing(r)) return err(req, MISSING_BACKEND.status, MISSING_BACKEND.code, MISSING_BACKEND.message);
  const out = r.ok ? (Array.isArray(r.data) ? r.data[0] : r.data) : null;
  if (!r.ok || out === null || typeof out !== "object" || typeof out.ok !== "boolean") {
    console.error("ai-service: apply_ai_suggestion_decision failed, HTTP", r.status);
    return err(req, 502, "decision_failed", "La décision n'a pas pu être enregistrée. Aucune modification n'a été appliquée : réessayez.");
  }
  if (!out.ok) {
    const e = DECISION_ERRORS[String(out.code)] ?? { status: 422, message: "Décision refusée." };
    return json({ error: String(out.code), message: e.message, ...(out.code === "report_changed" ? { current: out.current } : {}) }, e.status, req);
  }
  return json({ ok: true, replayed: out.replayed === true, decision: out.decision }, out.replayed ? 200 : 201, req);
}

// ---------------------------------------------------------------- GET /decisions
export async function listDecisions(req: Request) {
  const r = await rest("/rest/v1/ai_suggestion_decisions?order=decided_at.desc&limit=50&select=id,prediction_id,report_id,decision,decided_at,decided_by,final_category,final_priority,priority_lowered");
  if (backendMissing(r)) return json({ data: [], enabled: false }, 200, req);
  if (!r.ok) return err(req, 502, "decisions_read_failed", "Historique des décisions illisible.");
  return json({ data: Array.isArray(r.data) ? r.data : [], enabled: true }, 200, req);
}

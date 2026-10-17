-- ============================================================
-- 026 — Validation humaine des suggestions de classification Gemini
-- Additive, idempotente, NON destructive : aucun DROP TABLE/COLUMN, aucun TRUNCATE, aucun DELETE de données,
-- aucune ancienne migration modifiée, RLS jamais désactivée.
--
-- Contenu
--   1. Table public.ai_suggestion_decisions : historique APPEND-ONLY (une décision par suggestion).
--   2. RLS : lecture réservée au personnel (is_staff()) ; AUCUNE politique d'écriture pour anon/authenticated.
--   3. Fonction public.apply_ai_suggestion_decision() : applique la décision ET écrit l'historique + l'audit
--      dans UNE seule transaction (tout réussit ou rien n'est modifié). Appelable uniquement par service_role
--      (Edge Function ai-service, qui a déjà authentifié l'utilisateur). Les contrôles sont refaits ici
--      (rôle, baisse de priorité, valeurs autorisées, concurrence) : défense en profondeur.
--
-- Rollback (aucune donnée métier n'est touchée par cette migration) :
--   DROP FUNCTION IF EXISTS public.apply_ai_suggestion_decision(uuid,uuid,text,boolean,boolean,text,text,boolean,text,text,timestamptz,text,uuid);
--   DROP TABLE IF EXISTS public.ai_suggestion_decisions;   -- supprime l'historique des décisions (à n'exécuter que volontairement)
--   DROP FUNCTION IF EXISTS public.ai_suggestion_decisions_block_update();
-- ============================================================

-- ------------------------------------------------------------
-- 1. Historique des décisions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_suggestion_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id uuid NOT NULL REFERENCES public.ai_predictions(id) ON DELETE RESTRICT,
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('accepted', 'modified', 'rejected')),
  -- ce que Gemini a proposé (copie au moment de la décision)
  suggested_category text NOT NULL,
  suggested_priority text NOT NULL,
  -- valeurs du signalement AVANT / APRÈS la décision
  previous_category public.report_category NOT NULL,
  previous_priority public.report_priority NOT NULL,
  final_category public.report_category NOT NULL,
  final_priority public.report_priority NOT NULL,
  category_applied boolean NOT NULL DEFAULT false,
  priority_applied boolean NOT NULL DEFAULT false,
  priority_lowered boolean NOT NULL DEFAULT false,
  -- qui / quand
  decided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_role text NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  comment text CHECK (comment IS NULL OR char_length(comment) <= 500),
  -- suggestion complète telle que produite par le modèle (aucun secret : résumé, faits, hypothèses, recommandation)
  suggestion_snapshot jsonb NOT NULL,
  model_name text,
  -- clé d'idempotence fournie par le client : un double clic / une requête rejouée ne crée qu'UNE décision
  request_id uuid NOT NULL,
  CONSTRAINT ai_decisions_one_per_prediction UNIQUE (prediction_id),
  CONSTRAINT ai_decisions_request_unique UNIQUE (request_id),
  CONSTRAINT ai_decisions_rejected_unchanged CHECK (
    decision <> 'rejected'
    OR (final_category = previous_category AND final_priority = previous_priority
        AND NOT category_applied AND NOT priority_applied AND NOT priority_lowered)
  )
);

CREATE INDEX IF NOT EXISTS idx_ai_decisions_report ON public.ai_suggestion_decisions (report_id, decided_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_decided_at ON public.ai_suggestion_decisions (decided_at DESC);

-- Append-only : une décision enregistrée ne se modifie plus (même avec la clé service).
CREATE OR REPLACE FUNCTION public.ai_suggestion_decisions_block_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'ai_suggestion_decisions est en ajout seul : une décision enregistrée ne peut pas être modifiée';
END $$;

DROP TRIGGER IF EXISTS trg_ai_decisions_no_update ON public.ai_suggestion_decisions;
CREATE TRIGGER trg_ai_decisions_no_update BEFORE UPDATE ON public.ai_suggestion_decisions
  FOR EACH ROW EXECUTE FUNCTION public.ai_suggestion_decisions_block_update();

-- ------------------------------------------------------------
-- 2. RLS : lecture personnel uniquement, aucune écriture directe
-- ------------------------------------------------------------
ALTER TABLE public.ai_suggestion_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_ai_suggestion_decisions" ON public.ai_suggestion_decisions;
CREATE POLICY "staff_read_ai_suggestion_decisions" ON public.ai_suggestion_decisions
  FOR SELECT TO authenticated USING (public.is_staff());

REVOKE ALL ON public.ai_suggestion_decisions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ai_suggestion_decisions TO authenticated;
GRANT ALL ON public.ai_suggestion_decisions TO service_role;

-- ------------------------------------------------------------
-- 3. Application atomique d'une décision
--    Retourne toujours un jsonb { ok: true, ... } ou { ok: false, code: '...' } (jamais d'écriture partielle :
--    toutes les vérifications précèdent les écritures, et les écritures sont dans un bloc à sous-transaction).
--    Codes d'échec : invalid_decision, forbidden, request_id_conflict, prediction_not_found, already_decided,
--    report_not_found, report_changed, invalid_suggestion, nothing_to_apply, invalid_value, not_modified,
--    priority_decrease_forbidden, priority_decrease_unconfirmed.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_ai_suggestion_decision(
  p_prediction_id uuid,
  p_actor_id uuid,
  p_decision text,                       -- 'accepted' | 'modified' | 'rejected'
  p_apply_category boolean,              -- accepted : champs explicitement approuvés
  p_apply_priority boolean,
  p_category text,                       -- modified : valeurs choisies par l'agent (ignorées sinon)
  p_priority text,
  p_confirm_priority_decrease boolean,   -- confirmation explicite d'une baisse de priorité
  p_expected_category text,              -- valeurs lues par l'interface (détection de modification concurrente)
  p_expected_priority text,
  p_expected_updated_at timestamptz,
  p_comment text,
  p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_staff_roles    text[] := ARRAY['admin','government','ministry','province','commune','agent'];
  v_lower_roles    text[] := ARRAY['admin','government','ministry','province'];  -- rôles autorisés à BAISSER une priorité
  v_ranks          text[] := ARRAY['low','medium','high','critical'];
  v_cats           text[] := enum_range(NULL::public.report_category)::text[];
  v_pris           text[] := enum_range(NULL::public.report_priority)::text[];
  v_role           text;
  v_active         boolean;
  v_pred           public.ai_predictions%ROWTYPE;
  v_report         public.reports%ROWTYPE;
  v_existing       public.ai_suggestion_decisions%ROWTYPE;
  v_row            public.ai_suggestion_decisions%ROWTYPE;
  v_sugg_cat       text;
  v_sugg_pri       text;
  v_final_cat      public.report_category;
  v_final_pri      public.report_priority;
  v_cat_applied    boolean := false;
  v_pri_applied    boolean := false;
  v_lowered        boolean := false;
  v_comment        text := NULLIF(btrim(COALESCE(p_comment, '')), '');
BEGIN
  IF p_decision IS NULL OR p_decision NOT IN ('accepted', 'modified', 'rejected') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_decision');
  END IF;
  IF p_request_id IS NULL OR p_prediction_id IS NULL OR p_actor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_decision');
  END IF;
  IF v_comment IS NOT NULL AND char_length(v_comment) > 500 THEN
    v_comment := left(v_comment, 500);
  END IF;

  -- 1) Acteur : profil actif ET rôle du personnel (contrôle refait ici même si l'Edge Function l'a déjà fait)
  SELECT p.role::text, p.is_active INTO v_role, v_active FROM public.profiles p WHERE p.id = p_actor_id;
  IF NOT FOUND OR v_active IS NOT TRUE OR v_role IS NULL OR NOT (v_role = ANY (v_staff_roles)) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  -- 2) Requête déjà traitée (double clic, nouvel essai après coupure réseau) : on renvoie la décision existante
  SELECT * INTO v_existing FROM public.ai_suggestion_decisions WHERE request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.prediction_id = p_prediction_id AND v_existing.decided_by IS NOT DISTINCT FROM p_actor_id THEN
      RETURN jsonb_build_object('ok', true, 'replayed', true, 'decision', to_jsonb(v_existing));
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'request_id_conflict');
  END IF;

  -- 3) Suggestion : verrou de ligne => deux décisions simultanées sur la même suggestion sont sérialisées
  SELECT * INTO v_pred FROM public.ai_predictions
   WHERE id = p_prediction_id AND model = 'report_classification' AND target_type = 'report' AND target_id IS NOT NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'prediction_not_found');
  END IF;

  SELECT * INTO v_existing FROM public.ai_suggestion_decisions WHERE prediction_id = p_prediction_id;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_decided', 'decision', to_jsonb(v_existing));
  END IF;

  -- 4) Signalement : toujours présent ? (verrou de ligne jusqu'à la fin de la transaction)
  SELECT * INTO v_report FROM public.reports WHERE id = v_pred.target_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'report_not_found');
  END IF;

  -- 5) Modification concurrente : les valeurs lues par l'agent doivent être celles d'aujourd'hui
  IF v_report.category::text IS DISTINCT FROM p_expected_category
     OR v_report.priority::text IS DISTINCT FROM p_expected_priority
     OR v_report.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RETURN jsonb_build_object('ok', false, 'code', 'report_changed',
      'current', jsonb_build_object('category', v_report.category, 'priority', v_report.priority,
                                    'status', v_report.status, 'updated_at', v_report.updated_at));
  END IF;

  -- 6) La suggestion vient TOUJOURS de la base (jamais du client) et doit rester une valeur autorisée
  v_sugg_cat := v_pred.prediction ->> 'category';
  v_sugg_pri := v_pred.prediction ->> 'priority';
  IF v_sugg_cat IS NULL OR NOT (v_sugg_cat = ANY (v_cats)) OR v_sugg_pri IS NULL OR NOT (v_sugg_pri = ANY (v_pris)) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_suggestion');
  END IF;

  -- 7) Valeurs finales
  v_final_cat := v_report.category;
  v_final_pri := v_report.priority;

  IF p_decision = 'accepted' THEN
    IF NOT (COALESCE(p_apply_category, false) OR COALESCE(p_apply_priority, false)) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'nothing_to_apply');
    END IF;
    IF COALESCE(p_apply_category, false) THEN v_final_cat := v_sugg_cat::public.report_category; v_cat_applied := true; END IF;
    IF COALESCE(p_apply_priority, false) THEN v_final_pri := v_sugg_pri::public.report_priority; v_pri_applied := true; END IF;

  ELSIF p_decision = 'modified' THEN
    IF p_category IS NULL OR NOT (p_category = ANY (v_cats)) OR p_priority IS NULL OR NOT (p_priority = ANY (v_pris)) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'invalid_value');
    END IF;
    IF p_category = v_sugg_cat AND p_priority = v_sugg_pri THEN
      RETURN jsonb_build_object('ok', false, 'code', 'not_modified');   -- identique à la suggestion : utiliser « Accepter »
    END IF;
    v_final_cat := p_category::public.report_category;
    v_final_pri := p_priority::public.report_priority;
    v_cat_applied := true;
    v_pri_applied := true;
  END IF;
  -- 'rejected' : ni catégorie ni priorité ne changent.

  -- 8) Baisse de priorité (et a fortiori de « critical ») : rôle habilité + confirmation explicite
  IF array_position(v_ranks, v_final_pri::text) < array_position(v_ranks, v_report.priority::text) THEN
    v_lowered := true;
    IF NOT (v_role = ANY (v_lower_roles)) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'priority_decrease_forbidden');
    END IF;
    IF p_confirm_priority_decrease IS NOT TRUE THEN
      RETURN jsonb_build_object('ok', false, 'code', 'priority_decrease_unconfirmed');
    END IF;
  END IF;

  -- 9) Écritures atomiques : mise à jour + historique + audit. Le bloc BEGIN … EXCEPTION est une sous-transaction :
  --    en cas d'erreur, la mise à jour du signalement est annulée avec le reste.
  BEGIN
    IF v_final_cat IS DISTINCT FROM v_report.category OR v_final_pri IS DISTINCT FROM v_report.priority THEN
      UPDATE public.reports SET category = v_final_cat, priority = v_final_pri WHERE id = v_report.id;
    END IF;

    INSERT INTO public.ai_suggestion_decisions (
      prediction_id, report_id, decision, suggested_category, suggested_priority,
      previous_category, previous_priority, final_category, final_priority,
      category_applied, priority_applied, priority_lowered,
      decided_by, decided_role, comment, suggestion_snapshot, model_name, request_id
    ) VALUES (
      v_pred.id, v_report.id, p_decision, v_sugg_cat, v_sugg_pri,
      v_report.category, v_report.priority, v_final_cat, v_final_pri,
      v_cat_applied, v_pri_applied, v_lowered,
      p_actor_id, v_role, v_comment, v_pred.prediction, v_pred.features ->> 'model', p_request_id
    ) RETURNING * INTO v_row;

    INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, details)
    VALUES (p_actor_id, 'ai_suggestion_' || p_decision, 'report', v_report.id, jsonb_build_object(
      'decision_id', v_row.id, 'prediction_id', v_pred.id,
      'previous', jsonb_build_object('category', v_report.category, 'priority', v_report.priority),
      'final', jsonb_build_object('category', v_final_cat, 'priority', v_final_pri),
      'priority_lowered', v_lowered));
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_decided');
  END;

  RETURN jsonb_build_object('ok', true, 'replayed', false, 'decision', to_jsonb(v_row));
END $$;

REVOKE ALL ON FUNCTION public.apply_ai_suggestion_decision(uuid, uuid, text, boolean, boolean, text, text, boolean, text, text, timestamptz, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_ai_suggestion_decision(uuid, uuid, text, boolean, boolean, text, text, boolean, text, text, timestamptz, text, uuid)
  TO service_role;

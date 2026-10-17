-- =====================================================================================
-- TESTS SQL — migration 026 (validation humaine des suggestions Gemini)
-- À exécuter UNIQUEMENT sur une base JETABLE (jamais sur un projet réel) :
--   bash database/tests/run_migrations_local.sh                     # chaîne 001 → 026 + supabase_stub.sql
--   psql -v ON_ERROR_STOP=1 -d smartcity_test -f database/tests/test_ai_decisions.sql
-- Tout se déroule dans UNE transaction terminée par ROLLBACK : aucune donnée n'est conservée.
-- Sortie attendue : une ligne « OK … » par test, puis « TOUS LES TESTS SQL 026 : OK ».
-- ⚠ Ce script a été écrit mais n'a PAS pu être exécuté dans l'environnement de livraison (pas de PostgreSQL
--   disponible) : à lancer avant tout déploiement.
-- =====================================================================================
\set ON_ERROR_STOP on
BEGIN;

-- ---------------------------------------------------------------- fixtures
INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'admin@t.test'),
  ('a0000000-0000-4000-8000-000000000002', 'agent@t.test'),
  ('a0000000-0000-4000-8000-000000000003', 'province@t.test'),
  ('a0000000-0000-4000-8000-000000000004', 'citizen@t.test'),
  ('a0000000-0000-4000-8000-000000000005', 'inactive@t.test');
UPDATE public.profiles SET role = 'admin'    WHERE id = 'a0000000-0000-4000-8000-000000000001';
UPDATE public.profiles SET role = 'agent'    WHERE id = 'a0000000-0000-4000-8000-000000000002';
UPDATE public.profiles SET role = 'province' WHERE id = 'a0000000-0000-4000-8000-000000000003';
UPDATE public.profiles SET role = 'citizen'  WHERE id = 'a0000000-0000-4000-8000-000000000004';
UPDATE public.profiles SET role = 'admin', is_active = false WHERE id = 'a0000000-0000-4000-8000-000000000005';

-- (signalement, catégorie, priorité) ; (suggestion, catégorie proposée, priorité proposée)
INSERT INTO public.reports (id, category, title, description, priority) VALUES
  ('b0000000-0000-4000-8000-000000000001', 'waste', 'R1 déchets', 'Description R1 suffisamment longue', 'critical'),
  ('b0000000-0000-4000-8000-000000000002', 'other', 'R2 autre',   'Description R2 suffisamment longue', 'medium'),
  ('b0000000-0000-4000-8000-000000000003', 'waste', 'R3 déchets', 'Description R3 suffisamment longue', 'critical'),
  ('b0000000-0000-4000-8000-000000000004', 'other', 'R4 autre',   'Description R4 suffisamment longue', 'low'),
  ('b0000000-0000-4000-8000-000000000005', 'waste', 'R5 déchets', 'Description R5 suffisamment longue', 'critical'),
  ('b0000000-0000-4000-8000-000000000006', 'other', 'R6 autre',   'Description R6 suffisamment longue', 'medium');

INSERT INTO public.ai_predictions (id, model, target_type, target_id, prediction, features)
SELECT p.id, 'report_classification', 'report', p.rid,
       jsonb_build_object('category', p.cat, 'priority', p.pri, 'summary', 'Résumé ' || p.cat, 'facts', '[]'::jsonb,
                          'assumptions', '[]'::jsonb, 'recommendation', 'Reco'),
       jsonb_build_object('provider', 'gemini', 'model', 'test-model', 'is_llm', true)
FROM (VALUES
  ('c0000000-0000-4000-8000-000000000001'::uuid, 'b0000000-0000-4000-8000-000000000001'::uuid, 'waste',    'medium'),
  ('c0000000-0000-4000-8000-000000000002'::uuid, 'b0000000-0000-4000-8000-000000000002'::uuid, 'lighting', 'high'),
  ('c0000000-0000-4000-8000-000000000003'::uuid, 'b0000000-0000-4000-8000-000000000003'::uuid, 'waste',    'medium'),
  ('c0000000-0000-4000-8000-000000000004'::uuid, 'b0000000-0000-4000-8000-000000000004'::uuid, 'water',    'medium'),
  ('c0000000-0000-4000-8000-000000000005'::uuid, 'b0000000-0000-4000-8000-000000000005'::uuid, 'waste',    'medium'),
  ('c0000000-0000-4000-8000-000000000006'::uuid, 'b0000000-0000-4000-8000-000000000006'::uuid, 'lighting', 'high')
) AS p(id, rid, cat, pri);

-- Aide : appelle la fonction avec les valeurs ACTUELLES du signalement comme « valeurs lues par l'agent ».
CREATE FUNCTION pg_temp.dec(p_pred uuid, p_actor uuid, p_decision text, p_ac boolean, p_ap boolean,
                            p_cat text, p_pri text, p_confirm boolean, p_req uuid DEFAULT gen_random_uuid())
RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.apply_ai_suggestion_decision(p_pred, p_actor, p_decision, p_ac, p_ap, p_cat, p_pri, p_confirm,
           r.category::text, r.priority::text, r.updated_at, NULL, p_req)
  FROM public.reports r WHERE r.id = (SELECT target_id FROM public.ai_predictions WHERE id = p_pred)
$$;

-- Aide d'assertion avec libellé affiché
CREATE FUNCTION pg_temp.ok(p_label text, p_cond boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS NOT TRUE THEN RAISE EXCEPTION 'ÉCHEC : %', p_label; END IF;
  RAISE NOTICE 'OK  %', p_label;
END $$;

-- ---------------------------------------------------------------- 1. Accepter (agent) : champs appliqués, historique, audit
DO $$
DECLARE r jsonb; rep public.reports%ROWTYPE; n int; d public.ai_suggestion_decisions%ROWTYPE;
BEGIN
  r := pg_temp.dec('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'accepted', true, true, NULL, NULL, false);
  PERFORM pg_temp.ok('accepter : ok=true', (r->>'ok')::boolean);
  SELECT * INTO rep FROM public.reports WHERE id = 'b0000000-0000-4000-8000-000000000002';
  PERFORM pg_temp.ok('accepter : catégorie/priorité appliquées', rep.category = 'lighting' AND rep.priority = 'high');
  PERFORM pg_temp.ok('accepter : statut inchangé', rep.status = 'pending');
  SELECT * INTO d FROM public.ai_suggestion_decisions WHERE prediction_id = 'c0000000-0000-4000-8000-000000000002';
  PERFORM pg_temp.ok('historique : décision, avant, après, auteur',
    d.decision = 'accepted' AND d.previous_category = 'other' AND d.previous_priority = 'medium'
    AND d.final_category = 'lighting' AND d.final_priority = 'high'
    AND d.decided_by = 'a0000000-0000-4000-8000-000000000002' AND d.decided_role = 'agent' AND d.decided_at IS NOT NULL
    AND d.suggestion_snapshot->>'summary' = 'Résumé lighting' AND d.model_name = 'test-model');
  SELECT count(*) INTO n FROM public.audit_log WHERE action = 'ai_suggestion_accepted' AND entity_id = 'b0000000-0000-4000-8000-000000000002';
  PERFORM pg_temp.ok('audit_log : une ligne', n = 1);
END $$;

-- ---------------------------------------------------------------- 2. Double soumission / décision déjà prise
DO $$
DECLARE req uuid := gen_random_uuid(); a jsonb; b jsonb; c jsonb; n int;
BEGIN
  -- même request_id rejoué sur une suggestion déjà décidée : renvoie la décision existante si c'est la MÊME requête
  SELECT request_id INTO req FROM public.ai_suggestion_decisions WHERE prediction_id = 'c0000000-0000-4000-8000-000000000002';
  a := public.apply_ai_suggestion_decision('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'accepted',
        true, true, NULL, NULL, false, 'lighting', 'high', (SELECT updated_at FROM public.reports WHERE id = 'b0000000-0000-4000-8000-000000000002'), NULL, req);
  PERFORM pg_temp.ok('rejeu du même request_id : ok + replayed', (a->>'ok')::boolean AND (a->>'replayed')::boolean);
  -- autre request_id sur la même suggestion
  b := pg_temp.dec('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'rejected', false, false, NULL, NULL, false);
  PERFORM pg_temp.ok('deuxième décision sur la même suggestion : already_decided', b->>'code' = 'already_decided');
  -- même request_id utilisé pour une AUTRE suggestion
  c := public.apply_ai_suggestion_decision('c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002', 'rejected',
        false, false, NULL, NULL, false, 'other', 'low', (SELECT updated_at FROM public.reports WHERE id = 'b0000000-0000-4000-8000-000000000004'), NULL, req);
  PERFORM pg_temp.ok('request_id réutilisé pour une autre suggestion : request_id_conflict', c->>'code' = 'request_id_conflict');
  SELECT count(*) INTO n FROM public.ai_suggestion_decisions;
  PERFORM pg_temp.ok('une seule décision enregistrée jusqu\'ici', n = 1);
END $$;

-- ---------------------------------------------------------------- 3. Utilisateurs non autorisés
DO $$
DECLARE n int;
BEGIN
  PERFORM pg_temp.ok('citoyen refusé', pg_temp.dec('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004', 'rejected', false, false, NULL, NULL, false)->>'code' = 'forbidden');
  PERFORM pg_temp.ok('compte inactif refusé', pg_temp.dec('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000005', 'rejected', false, false, NULL, NULL, false)->>'code' = 'forbidden');
  PERFORM pg_temp.ok('utilisateur inconnu refusé', pg_temp.dec('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-0000000000ff', 'rejected', false, false, NULL, NULL, false)->>'code' = 'forbidden');
  SELECT count(*) INTO n FROM public.ai_suggestion_decisions WHERE prediction_id = 'c0000000-0000-4000-8000-000000000003';
  PERFORM pg_temp.ok('aucune décision écrite pour les refusés', n = 0);
  PERFORM pg_temp.ok('suggestion inexistante : prediction_not_found',
    public.apply_ai_suggestion_decision('c0000000-0000-4000-8000-0000000000ee', 'a0000000-0000-4000-8000-000000000002', 'rejected',
      false, false, NULL, NULL, false, 'waste', 'critical', now(), NULL, gen_random_uuid())->>'code' = 'prediction_not_found');
END $$;

-- ---------------------------------------------------------------- 4. Priorité critique : jamais abaissée sans rôle habilité ET confirmation
DO $$
DECLARE rep public.reports%ROWTYPE; r jsonb; d public.ai_suggestion_decisions%ROWTYPE;
BEGIN
  r := pg_temp.dec('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'accepted', false, true, NULL, NULL, true);
  PERFORM pg_temp.ok('agent : baisse de priorité refusée même avec confirmation', r->>'code' = 'priority_decrease_forbidden');
  r := pg_temp.dec('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'accepted', false, true, NULL, NULL, false);
  PERFORM pg_temp.ok('admin sans confirmation : refusée', r->>'code' = 'priority_decrease_unconfirmed');
  SELECT * INTO rep FROM public.reports WHERE id = 'b0000000-0000-4000-8000-000000000001';
  PERFORM pg_temp.ok('priorité critique inchangée après les refus', rep.priority = 'critical');
  r := pg_temp.dec('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'accepted', false, true, NULL, NULL, true);
  PERFORM pg_temp.ok('admin avec confirmation : acceptée', (r->>'ok')::boolean);
  SELECT * INTO rep FROM public.reports WHERE id = 'b0000000-0000-4000-8000-000000000001';
  SELECT * INTO d FROM public.ai_suggestion_decisions WHERE prediction_id = 'c0000000-0000-4000-8000-000000000001';
  PERFORM pg_temp.ok('priorité abaissée à medium + historique priority_lowered', rep.priority = 'medium' AND d.priority_lowered AND d.previous_priority = 'critical' AND d.final_priority = 'medium');
END $$;

-- ---------------------------------------------------------------- 5. Rejeter : rien ne change, la suggestion est conservée
DO $$
DECLARE rep public.reports%ROWTYPE; d public.ai_suggestion_decisions%ROWTYPE; r jsonb;
BEGIN
  r := pg_temp.dec('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002', 'rejected', true, true, 'road', 'low', true);
  PERFORM pg_temp.ok('rejet : ok', (r->>'ok')::boolean);
  SELECT * INTO rep FROM public.reports WHERE id = 'b0000000-0000-4000-8000-000000000003';
  PERFORM pg_temp.ok('rejet : catégorie et priorité inchangées (même si des valeurs sont fournies)', rep.category = 'waste' AND rep.priority = 'critical');
  SELECT * INTO d FROM public.ai_suggestion_decisions WHERE prediction_id = 'c0000000-0000-4000-8000-000000000003';
  PERFORM pg_temp.ok('rejet : historique avec auteur, date, suggestion conservée',
    d.decision = 'rejected' AND d.decided_by IS NOT NULL AND d.decided_at IS NOT NULL
    AND NOT d.category_applied AND NOT d.priority_applied AND d.suggestion_snapshot->>'category' = 'waste');
  PERFORM pg_temp.ok('rejet : suggestion toujours présente dans ai_predictions',
    EXISTS (SELECT 1 FROM public.ai_predictions WHERE id = 'c0000000-0000-4000-8000-000000000003'));
END $$;

-- ---------------------------------------------------------------- 6. Modifier : valeurs vérifiées, précédentes conservées
DO $$
DECLARE r jsonb; rep public.reports%ROWTYPE; d public.ai_suggestion_decisions%ROWTYPE;
BEGIN
  r := pg_temp.dec('c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000003', 'modified', true, true, 'bogus', 'high', false);
  PERFORM pg_temp.ok('modifier : catégorie hors liste refusée', r->>'code' = 'invalid_value');
  r := pg_temp.dec('c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000003', 'modified', true, true, 'road', 'urgent', false);
  PERFORM pg_temp.ok('modifier : priorité hors liste refusée', r->>'code' = 'invalid_value');
  r := pg_temp.dec('c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000003', 'modified', true, true, 'water', 'medium', false);
  PERFORM pg_temp.ok('modifier : identique à la suggestion → not_modified', r->>'code' = 'not_modified');
  r := pg_temp.dec('c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000003', 'modified', true, true, 'road', 'high', false);
  PERFORM pg_temp.ok('modifier : ok', (r->>'ok')::boolean);
  SELECT * INTO rep FROM public.reports WHERE id = 'b0000000-0000-4000-8000-000000000004';
  SELECT * INTO d FROM public.ai_suggestion_decisions WHERE prediction_id = 'c0000000-0000-4000-8000-000000000004';
  PERFORM pg_temp.ok('modifier : valeurs finales appliquées, précédentes et suggestion conservées',
    rep.category = 'road' AND rep.priority = 'high' AND d.decision = 'modified' AND d.previous_category = 'other'
    AND d.previous_priority = 'low' AND d.suggested_category = 'water' AND d.suggested_priority = 'medium');
END $$;

-- ---------------------------------------------------------------- 7. Modification concurrente / rien à appliquer
DO $$
DECLARE stale timestamptz; r jsonb; rep public.reports%ROWTYPE;
BEGIN
  SELECT updated_at INTO stale FROM public.reports WHERE id = 'b0000000-0000-4000-8000-000000000005';
  PERFORM pg_sleep(0.01);
  UPDATE public.reports SET title = 'R5 modifié par quelqu''un d''autre' WHERE id = 'b0000000-0000-4000-8000-000000000005';
  r := public.apply_ai_suggestion_decision('c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000002', 'accepted',
        true, false, NULL, NULL, false, 'waste', 'critical', stale, NULL, gen_random_uuid());
  PERFORM pg_temp.ok('lecture périmée : report_changed', r->>'code' = 'report_changed');
  r := pg_temp.dec('c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000002', 'accepted', false, false, NULL, NULL, false);
  PERFORM pg_temp.ok('aucun champ approuvé : nothing_to_apply', r->>'code' = 'nothing_to_apply');
  r := public.apply_ai_suggestion_decision('c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000002', 'accepted',
        true, false, NULL, NULL, false, 'road', 'critical', (SELECT updated_at FROM public.reports WHERE id = 'b0000000-0000-4000-8000-000000000005'), NULL, gen_random_uuid());
  PERFORM pg_temp.ok('catégorie lue différente de l\'actuelle : report_changed', r->>'code' = 'report_changed');
  SELECT * INTO rep FROM public.reports WHERE id = 'b0000000-0000-4000-8000-000000000005';
  PERFORM pg_temp.ok('signalement inchangé après les refus', rep.priority = 'critical' AND rep.category = 'waste');
  PERFORM pg_temp.ok('aucune décision écrite', NOT EXISTS (SELECT 1 FROM public.ai_suggestion_decisions WHERE prediction_id = 'c0000000-0000-4000-8000-000000000005'));
END $$;

-- ---------------------------------------------------------------- 8. Atomicité : une erreur d'écriture annule AUSSI la mise à jour du signalement
CREATE FUNCTION public.zz_test_boom() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'panne simulée (audit_log)'; END $$;
DO $$
DECLARE rep public.reports%ROWTYPE; failed boolean := false;
BEGIN
  CREATE TRIGGER trg_test_boom BEFORE INSERT ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.zz_test_boom();
  BEGIN
    PERFORM pg_temp.dec('c0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000002', 'accepted', true, true, NULL, NULL, false);
  EXCEPTION WHEN OTHERS THEN failed := true;
  END;
  DROP TRIGGER trg_test_boom ON public.audit_log;
  PERFORM pg_temp.ok('l\'erreur d\'audit remonte (pas de succès silencieux)', failed);
  SELECT * INTO rep FROM public.reports WHERE id = 'b0000000-0000-4000-8000-000000000006';
  PERFORM pg_temp.ok('signalement NON modifié après l\'échec', rep.category = 'other' AND rep.priority = 'medium');
  PERFORM pg_temp.ok('aucune décision écrite après l\'échec', NOT EXISTS (SELECT 1 FROM public.ai_suggestion_decisions WHERE prediction_id = 'c0000000-0000-4000-8000-000000000006'));
END $$;

-- ---------------------------------------------------------------- 9. Historique en ajout seul + unicité
DO $$
DECLARE ko boolean := false;
BEGIN
  BEGIN UPDATE public.ai_suggestion_decisions SET comment = 'falsifié'; EXCEPTION WHEN OTHERS THEN ko := true; END;
  PERFORM pg_temp.ok('UPDATE sur l\'historique interdit (même superuser)', ko);
  ko := false;
  BEGIN
    INSERT INTO public.ai_suggestion_decisions (prediction_id, report_id, decision, suggested_category, suggested_priority,
      previous_category, previous_priority, final_category, final_priority, decided_role, suggestion_snapshot, request_id)
    VALUES ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'rejected', 'waste', 'medium',
      'waste', 'medium', 'waste', 'medium', 'agent', '{}', gen_random_uuid());
  EXCEPTION WHEN unique_violation THEN ko := true; END;
  PERFORM pg_temp.ok('une seule décision par suggestion (contrainte UNIQUE)', ko);
  ko := false;
  BEGIN
    INSERT INTO public.ai_suggestion_decisions (prediction_id, report_id, decision, suggested_category, suggested_priority,
      previous_category, previous_priority, final_category, final_priority, decided_role, suggestion_snapshot, request_id)
    VALUES ('c0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000005', 'rejected', 'waste', 'medium',
      'waste', 'critical', 'waste', 'medium', 'agent', '{}', gen_random_uuid());
  EXCEPTION WHEN check_violation THEN ko := true; END;
  PERFORM pg_temp.ok('un rejet ne peut pas porter de valeurs modifiées (CHECK)', ko);
END $$;

-- ---------------------------------------------------------------- 10. Droits et RLS
DO $$
DECLARE sig text := 'public.apply_ai_suggestion_decision(uuid,uuid,text,boolean,boolean,text,text,boolean,text,text,timestamptz,text,uuid)'; ko boolean := false; n int;
BEGIN
  PERFORM pg_temp.ok('RLS activée', (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.ai_suggestion_decisions'::regclass));
  PERFORM pg_temp.ok('authenticated : aucun INSERT/UPDATE/DELETE direct',
    NOT has_table_privilege('authenticated', 'public.ai_suggestion_decisions', 'INSERT')
    AND NOT has_table_privilege('authenticated', 'public.ai_suggestion_decisions', 'UPDATE')
    AND NOT has_table_privilege('authenticated', 'public.ai_suggestion_decisions', 'DELETE'));
  PERFORM pg_temp.ok('anon : aucun accès', NOT has_table_privilege('anon', 'public.ai_suggestion_decisions', 'SELECT'));
  PERFORM pg_temp.ok('fonction : service_role seulement',
    has_function_privilege('service_role', sig, 'EXECUTE')
    AND NOT has_function_privilege('authenticated', sig, 'EXECUTE')
    AND NOT has_function_privilege('anon', sig, 'EXECUTE'));

  -- lecture : personnel oui, citoyen non (RLS), écriture directe impossible
  PERFORM set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000002', true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.ai_suggestion_decisions;
  RESET ROLE;
  PERFORM pg_temp.ok('agent : peut lire l\'historique', n >= 1);

  PERFORM set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000004', true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.ai_suggestion_decisions;
  RESET ROLE;
  PERFORM pg_temp.ok('citoyen : ne voit aucune décision', n = 0);

  PERFORM set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000002', true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.ai_suggestion_decisions (prediction_id, report_id, decision, suggested_category, suggested_priority,
      previous_category, previous_priority, final_category, final_priority, decided_role, suggestion_snapshot, request_id)
    VALUES ('c0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000005', 'rejected', 'waste', 'medium',
      'waste', 'critical', 'waste', 'critical', 'agent', '{}', gen_random_uuid());
  EXCEPTION WHEN insufficient_privilege THEN ko := true; END;
  RESET ROLE;
  PERFORM pg_temp.ok('agent : INSERT direct dans l\'historique refusé', ko);
END $$;

DO $$ BEGIN RAISE NOTICE 'TOUS LES TESTS SQL 026 : OK'; END $$;
ROLLBACK;

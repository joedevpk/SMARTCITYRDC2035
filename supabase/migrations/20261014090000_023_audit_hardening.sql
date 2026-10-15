-- ============================================================
-- 023 — Correctifs issus de l'audit SQL/sécurité du 2026-10-14
-- Additive, idempotente, NON destructive (aucun DROP TABLE/COLUMN, aucun TRUNCATE, aucun DELETE de données).
-- Chaque point a été reproduit sur PostgreSQL 16 avant correction (voir docs/AUDIT_SQL_SECURITE.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. PostGIS peut résider dans le schéma « extensions » (activation via le dashboard Supabase).
--    Les fonctions épinglées sur search_path = public ne trouvent alors ni ST_Y/ST_X/ST_Distance
--    ni le type geography. Ajouter « extensions » est sans effet si PostGIS est dans public
--    (un schéma inexistant dans un search_path est ignoré par PostgreSQL).
-- ------------------------------------------------------------
ALTER FUNCTION public.get_devices_within_radius(double precision, double precision, integer)
  SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.get_gis_points_with_coords()  SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.get_iot_devices_with_coords() SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.get_reports_with_coords()     SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.reports_before_insert()       SET search_path TO 'public', 'extensions';

-- ------------------------------------------------------------
-- 2. Fonctions SECURITY DEFINER appelables par n'importe qui via /rest/v1/rpc (anon inclus)
--    - check_rate_limit : un anonyme pouvait consommer le quota d'un autre utilisateur ou d'un appareil IoT
--      (clé 'iot:<id>', 'ai-classify:<uid>') et remplir api_rate_limits. Seules les Edge Functions
--      (clé service) l'utilisent.
--    - log_audit_entry : un anonyme pouvait écrire dans audit_log avec un actor_id arbitraire
--      (falsification de la piste d'audit). Aucun code client ne l'appelle.
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.log_audit_entry(uuid, text, text, uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit_entry(uuid, text, text, uuid, jsonb, text) TO service_role;

-- Les RPC d'administration refusent déjà les non-admins ; on retire en plus l'accès anonyme (défense en profondeur).
REVOKE ALL ON FUNCTION public.admin_update_user_role(uuid, text)     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_toggle_user_active(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(uuid, text)     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_toggle_user_active(uuid, boolean) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.log_security_event(text, uuid, text, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_security_event(text, uuid, text, text, jsonb, text) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 3. Brouillons d'actualités lisibles par tout le monde (y compris anonymes)
--    Cause : la politique « public_read_news » (018) USING (true) s'ajoute (OR) à « select_published_news » (011).
--    Correction : lecture publique = articles publiés uniquement ; les admins gardent la lecture complète.
--    (Restreint des droits ; n'en élargit aucun.)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "public_read_news" ON public.news_articles;
DROP POLICY IF EXISTS "admin_read_all_news" ON public.news_articles;
CREATE POLICY "admin_read_all_news" ON public.news_articles
  FOR SELECT TO authenticated USING (public.is_admin());

-- ------------------------------------------------------------
-- 4. Intégrité référentielle : reports.reporter_id
--    reporter_id est « NOT NULL … ON DELETE SET NULL » ET le trigger d'immutabilité (022) réécrit
--    NEW.reporter_id := OLD.reporter_id. Quand le profil du déclarant est supprimé, l'action SET NULL de la
--    clé étrangère était annulée par le trigger : le signalement gardait un reporter_id ORPHELIN
--    (la contrainte FK devenait violée en silence ; un dump/restore échouerait).
--    Correction : (a) la colonne accepte NULL (conforme à l'intention « ON DELETE SET NULL » : anonymisation),
--    (b) le trigger n'autorise le passage à NULL que si le profil d'origine n'existe plus,
--    (c) les orphelins déjà présents sont mis à NULL (valeur sans signification : le profil n'existe plus).
--    L'immutabilité reste garantie pour tout autre cas ; la RLS (reporter_id = auth.uid()) est inchangée.
-- ------------------------------------------------------------
ALTER TABLE public.reports ALTER COLUMN reporter_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.reports_before_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ok boolean;
BEGIN
  -- immutable fields
  IF NEW.reporter_id IS DISTINCT FROM OLD.reporter_id THEN
    -- seule exception : action ON DELETE SET NULL de la clé étrangère, profil d'origine disparu
    IF NOT (NEW.reporter_id IS NULL AND OLD.reporter_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = OLD.reporter_id)) THEN
      NEW.reporter_id := OLD.reporter_id;
    END IF;
  END IF;
  NEW.reference := OLD.reference;
  NEW.created_at := OLD.created_at;
  NEW.is_demo := OLD.is_demo;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    ok := (OLD.status::text, NEW.status::text) IN (
      ('pending','validated'),('pending','rejected'),('validated','assigned'),('validated','rejected'),
      ('assigned','in_progress'),('in_progress','resolved'));
    IF NOT ok THEN
      RAISE EXCEPTION 'Invalid report status transition % -> %', OLD.status, NEW.status;
    END IF;
    IF NEW.status::text = 'resolved' THEN NEW.resolved_at := now(); END IF;
    IF NEW.status::text = 'validated' AND auth.uid() IS NOT NULL THEN NEW.validated_by := auth.uid(); END IF;
  END IF;
  RETURN NEW;
END $$;

UPDATE public.reports r SET reporter_id = NULL
 WHERE r.reporter_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = r.reporter_id);

-- ------------------------------------------------------------
-- 5. NON appliqué volontairement (décisions métier, voir docs/AUDIT_SQL_SECURITE.md §5) :
--    - interventions.agent_id et emergency_incidents.reported_by : même contradiction NOT NULL / SET NULL,
--      mais sans corruption (la suppression du profil est simplement refusée avec une erreur claire).
--    - emergency_incidents lisibles par tout utilisateur authentifié (adresse, déclarant).
--    - actualités de démonstration (011) publiées comme de vraies actualités.
-- ------------------------------------------------------------

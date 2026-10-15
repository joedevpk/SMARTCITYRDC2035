/*
# 022 — Security, data provenance and report workflow (corrective, non-destructive)

## Why
Audit of 2026-10-13 found: (1) seed/demo rows indistinguishable from real data, (2) IoT devices
without credentials (anyone "staff" could insert telemetry), (3) any authenticated user able to read
every citizen report, (4) status/priority of a new report chosen by the client, (5) role changes
possible for the 'government' role through is_admin(), (6) forgeable security/audit logs,
(7) ai_predictions.model CHECK too narrow for a real LLM use case.

## What
- is_demo / is_simulated provenance flags (pre-existing seed rows are flagged, nothing is deleted)
- iot_device_credentials (hash only, no policy => service role only)
- reports: forced safe INSERT values, workflow guard on UPDATE, automatic 'created' event,
  owner-or-staff SELECT, get_reports_with_coords()
- profiles: role / is_active can only be changed by a real admin (is_super_admin)
- audit/security logs: no anonymous direct INSERT; RPCs derive identity from auth.uid()
- ai_predictions.model CHECK widened

## Rollback notes
Every statement is additive or a policy replacement. To roll back: drop the new triggers/functions
listed below and recreate the old policies from migrations 004/016/0135. Data is untouched.

## Idempotency
Safe to run twice. Seed-flagging blocks only run the first time the column is created.
*/

-- ============================================================
-- 0. helpers
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND is_active);
$$;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_active
      AND role::text IN ('admin','government','ministry','province','commune','agent')
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- ============================================================
-- 1. Provenance flags (pre-existing rows are seed data => flagged, not deleted)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='iot_devices' AND column_name='is_simulated') THEN
    ALTER TABLE public.iot_devices ADD COLUMN is_simulated boolean NOT NULL DEFAULT false;
    UPDATE public.iot_devices SET is_simulated = true;   -- no authenticated device existed before this migration
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='iot_telemetry' AND column_name='is_simulated') THEN
    ALTER TABLE public.iot_telemetry ADD COLUMN is_simulated boolean NOT NULL DEFAULT false;
    UPDATE public.iot_telemetry SET is_simulated = true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='gis_points' AND column_name='is_demo') THEN
    ALTER TABLE public.gis_points ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
    UPDATE public.gis_points SET is_demo = true;          -- seeded by migration 005; unflag verified rows manually
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='emergency_incidents' AND column_name='is_demo') THEN
    ALTER TABLE public.emergency_incidents ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
    UPDATE public.emergency_incidents e SET is_demo = true
    WHERE e.reported_by IS NULL
       OR e.reported_by IN (SELECT id FROM auth.users WHERE email LIKE '%@smartcity-rdc.cd');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reports' AND column_name='is_demo') THEN
    ALTER TABLE public.reports ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
    UPDATE public.reports r SET is_demo = true
    WHERE r.reporter_id IN (SELECT id FROM auth.users WHERE email LIKE '%@smartcity-rdc.cd');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reports_created ON public.reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_is_demo ON public.reports (is_demo);
CREATE INDEX IF NOT EXISTS idx_telemetry_real ON public.iot_telemetry (metric, recorded_at DESC) WHERE is_simulated = false;
-- Replay protection: same device + metric + timestamp can only be stored once.
CREATE UNIQUE INDEX IF NOT EXISTS uq_telemetry_replay ON public.iot_telemetry (device_id, metric, recorded_at);

-- ============================================================
-- 2. IoT credentials (hash only; RLS on, NO policy => service role only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.iot_device_credentials (
  device_id uuid PRIMARY KEY REFERENCES public.iot_devices(id) ON DELETE CASCADE,
  api_key_hash text NOT NULL,
  rotated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.iot_device_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.iot_device_credentials FROM anon, authenticated;

-- Telemetry: only the service role (edge function) may insert. Drop every client-side INSERT policy.
DROP POLICY IF EXISTS "telemetry_insert" ON public.iot_telemetry;
DROP POLICY IF EXISTS "staff_insert_iot_telemetry" ON public.iot_telemetry;

DROP FUNCTION IF EXISTS public.get_iot_devices_with_coords();
CREATE FUNCTION public.get_iot_devices_with_coords()
RETURNS TABLE (id uuid, device_id text, name text, type text, status text, battery_level integer,
  last_seen timestamptz, lat double precision, lng double precision, commune_id uuid, metadata jsonb,
  is_simulated boolean)
LANGUAGE sql STABLE AS $$
  SELECT d.id, d.device_id, d.name, d.type, d.status, d.battery_level, d.last_seen,
         ST_Y(d.location), ST_X(d.location), d.commune_id, d.metadata, d.is_simulated
  FROM public.iot_devices d ORDER BY d.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_iot_devices_with_coords() TO anon, authenticated;
ALTER FUNCTION public.get_iot_devices_with_coords() SET search_path TO 'public', 'extensions'; -- PostGIS peut résider dans « extensions » (activation via le dashboard)

-- ============================================================
-- 3. AI predictions: widen model list; writes are service-role only
-- ============================================================
ALTER TABLE public.ai_predictions DROP CONSTRAINT IF EXISTS ai_predictions_model_check;
ALTER TABLE public.ai_predictions ADD CONSTRAINT ai_predictions_model_check CHECK (model IN (
  'traffic_forecast','anomaly_detection','energy_forecast','waste_optimization','incident_analysis',
  'incident_summary','report_classification'));
DROP POLICY IF EXISTS "ai_read" ON public.ai_predictions;
DROP POLICY IF EXISTS "staff_insert_ai_predictions" ON public.ai_predictions;
DROP POLICY IF EXISTS "staff_update_ai_predictions" ON public.ai_predictions;
DROP POLICY IF EXISTS "staff_delete_ai_predictions" ON public.ai_predictions;
DROP POLICY IF EXISTS "staff_read_ai_predictions" ON public.ai_predictions;
CREATE POLICY "staff_read_ai_predictions" ON public.ai_predictions FOR SELECT TO authenticated USING (public.is_staff());

-- ============================================================
-- 4. Reports: safe inserts, workflow guard, events, owner-or-staff reads
-- ============================================================
CREATE OR REPLACE FUNCTION public.reports_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$  -- ST_Y/ST_X : PostGIS peut résider dans « extensions »
BEGIN
  NEW.status := 'pending';
  NEW.assigned_to := NULL;
  NEW.validated_by := NULL;
  NEW.resolved_at := NULL;
  NEW.is_demo := false;
  IF auth.uid() IS NOT NULL THEN NEW.reporter_id := auth.uid(); END IF;
  IF NEW.location IS NOT NULL AND (ST_Y(NEW.location) NOT BETWEEN -90 AND 90 OR ST_X(NEW.location) NOT BETWEEN -180 AND 180) THEN
    RAISE EXCEPTION 'Invalid coordinates';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_reports_before_insert ON public.reports;
CREATE TRIGGER trg_reports_before_insert BEFORE INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.reports_before_insert();

CREATE OR REPLACE FUNCTION public.reports_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.report_events (report_id, event_type, to_status, actor_id)
  VALUES (NEW.id, 'created', 'pending', NEW.reporter_id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_reports_after_insert ON public.reports;
CREATE TRIGGER trg_reports_after_insert AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.reports_after_insert();

CREATE OR REPLACE FUNCTION public.reports_before_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ok boolean;
BEGIN
  -- immutable fields
  NEW.reporter_id := OLD.reporter_id;
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
DROP TRIGGER IF EXISTS trg_reports_before_update ON public.reports;
CREATE TRIGGER trg_reports_before_update BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.reports_before_update();

-- Direct (browser) updates by staff are traced here. The api-gateway (service role, auth.uid() IS NULL)
-- writes its own event with the verified actor.
CREATE OR REPLACE FUNCTION public.reports_after_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.report_events (report_id, event_type, from_status, to_status, actor_id)
    VALUES (NEW.id, NEW.status::text, OLD.status::text, NEW.status::text, auth.uid());
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_reports_after_update ON public.reports;
CREATE TRIGGER trg_reports_after_update AFTER UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.reports_after_update();

DROP POLICY IF EXISTS "auth_read_reports" ON public.reports;
DROP POLICY IF EXISTS "read_own_or_staff_reports" ON public.reports;
CREATE POLICY "read_own_or_staff_reports" ON public.reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "auth_read_events" ON public.report_events;
DROP POLICY IF EXISTS "read_own_or_staff_events" ON public.report_events;
CREATE POLICY "read_own_or_staff_events" ON public.report_events FOR SELECT TO authenticated
  USING (public.is_staff() OR EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.reporter_id = auth.uid()));

DROP POLICY IF EXISTS "auth_read_interventions" ON public.interventions;
DROP POLICY IF EXISTS "read_staff_interventions" ON public.interventions;
CREATE POLICY "read_staff_interventions" ON public.interventions FOR SELECT TO authenticated
  USING (public.is_staff() OR agent_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_reports_with_coords()
RETURNS TABLE (id uuid, reference text, category text, title text, status text, priority text,
  address text, created_at timestamptz, is_demo boolean, lat double precision, lng double precision)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, extensions AS $$   -- RLS of the caller applies ; « extensions » : PostGIS (ST_Y/ST_X) peut y résider
  SELECT r.id, r.reference, r.category::text, r.title, r.status::text, r.priority::text, r.address,
         r.created_at, r.is_demo, ST_Y(r.location), ST_X(r.location)
  FROM public.reports r WHERE r.location IS NOT NULL ORDER BY r.created_at DESC LIMIT 1000;
$$;
GRANT EXECUTE ON FUNCTION public.get_reports_with_coords() TO authenticated;

-- ============================================================
-- 5. Profiles: only a real admin may change role / is_active
-- ============================================================
CREATE OR REPLACE FUNCTION public.profiles_guard_privileged()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.is_active IS DISTINCT FROM OLD.is_active)
     AND auth.uid() IS NOT NULL            -- service role / migrations are not blocked
     AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only an administrator can change role or activation';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_profiles_guard_privileged ON public.profiles;
CREATE TRIGGER trg_profiles_guard_privileged BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_privileged();

CREATE OR REPLACE FUNCTION public.admin_update_user_role(p_user_id uuid, p_new_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Permission denied: admin access required'; END IF;
  IF p_new_role NOT IN ('admin','government','ministry','province','commune','police','emergency','water','energy','waste','transport','agent','citizen') THEN
    RAISE EXCEPTION 'Invalid role: %', p_new_role;
  END IF;
  IF p_user_id = auth.uid() AND p_new_role <> 'admin' THEN
    RAISE EXCEPTION 'An administrator cannot remove their own admin role';
  END IF;
  UPDATE public.profiles SET role = p_new_role::user_role, updated_at = now() WHERE id = p_user_id;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'profile.role_change', 'profile', p_user_id, jsonb_build_object('new_role', p_new_role));
END $$;
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_toggle_user_active(p_user_id uuid, p_active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Permission denied: admin access required'; END IF;
  IF p_user_id = auth.uid() AND p_active = false THEN RAISE EXCEPTION 'An administrator cannot deactivate themselves'; END IF;
  UPDATE public.profiles SET is_active = p_active, updated_at = now() WHERE id = p_user_id;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'profile.active_change', 'profile', p_user_id, jsonb_build_object('is_active', p_active));
END $$;
GRANT EXECUTE ON FUNCTION public.admin_toggle_user_active(uuid, boolean) TO authenticated;

-- ============================================================
-- 6. Audit / security logs: no forgeable direct INSERT
-- ============================================================
DROP POLICY IF EXISTS "audit_insert_anon" ON public.audit_log;
DROP POLICY IF EXISTS "auth_insert_audit" ON public.audit_log;
DROP POLICY IF EXISTS "audit_read_authenticated" ON public.audit_log;
DROP POLICY IF EXISTS "admin_read_audit" ON public.audit_log;
CREATE POLICY "admin_read_audit" ON public.audit_log FOR SELECT TO authenticated USING (public.is_super_admin());

DROP POLICY IF EXISTS "login_attempts_insert" ON public.login_attempts;
DROP POLICY IF EXISTS "security_events_insert" ON public.security_events;

-- Identity is derived from the session, never from parameters.
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type text, p_user_id uuid, p_ip text, p_agent text, p_details jsonb DEFAULT '{}'::jsonb, p_severity text DEFAULT 'info')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  INSERT INTO public.security_events (event_type, user_id, ip_address, user_agent, details, severity)
  VALUES (left(p_event_type, 64), auth.uid(), NULL, left(p_agent, 256), COALESCE(p_details, '{}'::jsonb),
          CASE WHEN p_severity IN ('info','warning','critical') THEN p_severity ELSE 'info' END);
END $$;
REVOKE EXECUTE ON FUNCTION public.log_security_event(text, uuid, text, text, jsonb, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.log_security_event(text, uuid, text, text, jsonb, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_login_attempt(p_identifier text, p_success boolean, p_agent text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_identifier IS NULL OR length(p_identifier) NOT BETWEEN 3 AND 254 THEN RETURN; END IF;
  INSERT INTO public.login_attempts (identifier, success, user_agent)
  VALUES (lower(p_identifier), COALESCE(p_success, false), left(p_agent, 256));
END $$;
GRANT EXECUTE ON FUNCTION public.record_login_attempt(text, boolean, text) TO anon, authenticated;
-- NOTE: this lockout is advisory (client-driven). Real brute-force protection = Supabase Auth rate limits.

-- ============================================================
-- 7. gis_points RPC exposes the demo flag (same columns + is_demo)
-- ============================================================
DROP FUNCTION IF EXISTS public.get_gis_points_with_coords();
CREATE FUNCTION public.get_gis_points_with_coords()
RETURNS TABLE (id uuid, category gis_category, name text, description text, commune_id uuid, status text,
  metadata jsonb, is_active boolean, lat double precision, lng double precision, is_demo boolean)
LANGUAGE sql STABLE SET search_path TO 'public', 'extensions' AS $$
  SELECT g.id, g.category, g.name, g.description, g.commune_id, g.status, g.metadata, g.is_active,
         ST_Y(g.location), ST_X(g.location), g.is_demo
  FROM public.gis_points g WHERE g.is_active = true AND g.location IS NOT NULL ORDER BY g.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_gis_points_with_coords() TO anon, authenticated;

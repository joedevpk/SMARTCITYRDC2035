/*
# RLS Tightening — Fix overly-permissive policies + add profiles INSERT

## Purpose
1. profiles: add INSERT policy so new users can create their own profile row
   (register flow). Without this, INSERT fails under RLS.
2. reports: restrict UPDATE to staff roles (admin, government, ministry,
   province, commune, agent) instead of "any authenticated user".
3. interventions: restrict INSERT/UPDATE to staff roles instead of "any
   authenticated user".
4. report_events: restrict INSERT to staff (system events are inserted by
   edge functions using service role, which bypasses RLS).
5. Domain tables (traffic_sensors, energy_assets, water_assets,
   lighting_assets, security_cameras): restrict INSERT/UPDATE/DELETE to
   staff roles instead of "any authenticated user".

## Security
- Citizens can no longer mutate infrastructure data or other users' reports.
- New users can self-register a profile row (role defaults to 'citizen').
- All changes are idempotent (DROP IF EXISTS before CREATE).
- No data is modified or deleted.
*/

-- ========== profiles: INSERT policy for self-registration ==========
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
CREATE POLICY "insert_own_profile" ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- ========== reports: tighten UPDATE to staff only ==========
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_update_report" ON public.reports;
CREATE POLICY "agent_update_report" ON public.reports FOR UPDATE
  TO authenticated USING (
    public.get_current_user_role() IN ('admin','government','ministry','province','commune','agent')
  ) WITH CHECK (
    public.get_current_user_role() IN ('admin','government','ministry','province','commune','agent')
  );

-- ========== interventions: tighten to staff only ==========
ALTER TABLE public.interventions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_insert_intervention" ON public.interventions;
CREATE POLICY "admin_insert_intervention" ON public.interventions FOR INSERT
  TO authenticated WITH CHECK (
    public.get_current_user_role() IN ('admin','government','ministry','province','commune','agent')
  );

DROP POLICY IF EXISTS "agent_update_intervention" ON public.interventions;
CREATE POLICY "agent_update_intervention" ON public.interventions FOR UPDATE
  TO authenticated USING (
    public.get_current_user_role() IN ('admin','government','ministry','province','commune','agent')
  ) WITH CHECK (
    public.get_current_user_role() IN ('admin','government','ministry','province','commune','agent')
  );

-- ========== report_events: tighten INSERT to staff ==========
ALTER TABLE public.report_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert_event" ON public.report_events;
CREATE POLICY "insert_event" ON public.report_events FOR INSERT
  TO authenticated WITH CHECK (
    public.get_current_user_role() IN ('admin','government','ministry','province','commune','agent')
  );

-- ========== Domain tables: tighten INSERT/UPDATE/DELETE to staff ==========
-- Helper to apply staff-only write policies to a domain table
CREATE OR REPLACE FUNCTION apply_domain_write_policies(t text) RETURNS void AS $$
BEGIN
  EXECUTE format('DROP POLICY IF EXISTS "auth_insert_%s" ON %I;', t, t);
  EXECUTE format(
    'CREATE POLICY "auth_insert_%s" ON %I FOR INSERT TO authenticated WITH CHECK (public.get_current_user_role() IN (''admin'',''government'',''ministry'',''province'',''commune'',''agent''));',
    t, t
  );
  EXECUTE format('DROP POLICY IF EXISTS "auth_update_%s" ON %I;', t, t);
  EXECUTE format(
    'CREATE POLICY "auth_update_%s" ON %I FOR UPDATE TO authenticated USING (public.get_current_user_role() IN (''admin'',''government'',''ministry'',''province'',''commune'',''agent'')) WITH CHECK (public.get_current_user_role() IN (''admin'',''government'',''ministry'',''province'',''commune'',''agent''));',
    t, t
  );
  EXECUTE format('DROP POLICY IF EXISTS "auth_delete_%s" ON %I;', t, t);
  EXECUTE format(
    'CREATE POLICY "auth_delete_%s" ON %I FOR DELETE TO authenticated USING (public.get_current_user_role() IN (''admin'',''government'',''ministry'',''province'',''commune'',''agent''));',
    t, t
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT apply_domain_write_policies('traffic_sensors');
SELECT apply_domain_write_policies('energy_assets');
SELECT apply_domain_write_policies('water_assets');
SELECT apply_domain_write_policies('lighting_assets');
SELECT apply_domain_write_policies('security_cameras');

DROP FUNCTION apply_domain_write_policies(text);

-- ========== emergency_incidents: tighten UPDATE to staff ==========
ALTER TABLE public.emergency_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_update_emergency" ON public.emergency_incidents;
CREATE POLICY "agent_update_emergency" ON public.emergency_incidents FOR UPDATE
  TO authenticated USING (
    public.get_current_user_role() IN ('admin','government','ministry','province','commune','agent','police','emergency')
  ) WITH CHECK (
    public.get_current_user_role() IN ('admin','government','ministry','province','commune','agent','police','emergency')
  );

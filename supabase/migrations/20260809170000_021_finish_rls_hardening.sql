/*
# Finish RLS hardening — close the remaining wide-open write policies

## Problem
The repo's own `audit-posture.txt` (a point-in-time RLS audit, kept in the
repo root) shows that migrations 016 and 018 tightened write access on
some tables (reports, interventions, gis_points, iot_devices, quartiers,
provinces, communes, news_articles, the 5 "domain" tables) but left many
others with `USING (true)` / `WITH CHECK (true)` for `anon` and/or
`authenticated` on INSERT, UPDATE and DELETE. In practice this means any
signed-in citizen (and in several cases, an unauthenticated visitor who
merely has the public anon key) could rewrite or delete infrastructure
data: energy stations, water reservoirs, waste trucks, traffic cameras,
security patrols, AI predictions, IoT sensor readings, etc.

None of these domain dashboards currently perform writes from the browser
(they read from Supabase or use static data), and the one place that does
write high-volume sensor data — the `iot-ingest` edge function — uses the
Supabase service role key, which bypasses RLS entirely. So tightening
these policies to "staff roles only" does not remove any working feature;
it only removes an unintended door.

## Fix
For every remaining over-permissive table, drop the exact legacy policy
(by the name recorded in audit-posture.txt, so it is actually replaced —
RLS policies are OR'd together, so adding a stricter policy without
dropping the old permissive one would change nothing) and recreate
INSERT/UPDATE/DELETE restricted to staff roles. Public/authenticated
SELECT is left untouched — these are public dashboards by design.

## Security
- Idempotent: every DROP uses IF EXISTS, every CREATE recreates from
  scratch, so this is safe to run more than once and safe to run whether
  or not the legacy policy names exist.
- No data is modified or deleted.
*/

CREATE OR REPLACE FUNCTION public.harden_domain_table(
  p_table text,
  p_legacy_insert text,
  p_legacy_update text,
  p_legacy_delete text
) RETURNS void AS $$
BEGIN
  -- Remove the legacy wide-open policies (exact names from audit-posture.txt)
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', p_legacy_insert, p_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', p_legacy_update, p_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', p_legacy_delete, p_table);

  -- Also remove/replace anything already created under the new naming
  -- scheme, in case this migration runs more than once.
  EXECUTE format('DROP POLICY IF EXISTS "staff_insert_%s" ON %I;', p_table, p_table);
  EXECUTE format(
    'CREATE POLICY "staff_insert_%s" ON %I FOR INSERT TO authenticated WITH CHECK (public.get_current_user_role() IN (''admin'',''government'',''ministry'',''province'',''commune'',''agent''));',
    p_table, p_table
  );

  EXECUTE format('DROP POLICY IF EXISTS "staff_update_%s" ON %I;', p_table, p_table);
  EXECUTE format(
    'CREATE POLICY "staff_update_%s" ON %I FOR UPDATE TO authenticated USING (public.get_current_user_role() IN (''admin'',''government'',''ministry'',''province'',''commune'',''agent'')) WITH CHECK (public.get_current_user_role() IN (''admin'',''government'',''ministry'',''province'',''commune'',''agent''));',
    p_table, p_table
  );

  EXECUTE format('DROP POLICY IF EXISTS "staff_delete_%s" ON %I;', p_table, p_table);
  EXECUTE format(
    'CREATE POLICY "staff_delete_%s" ON %I FOR DELETE TO authenticated USING (public.get_current_user_role() IN (''admin'',''government'',''ministry'',''province'',''commune'',''agent''));',
    p_table, p_table
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='energy_meters') THEN
    PERFORM public.harden_domain_table('energy_meters', 'em_insert', 'em_update', 'em_delete');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='energy_outages') THEN
    PERFORM public.harden_domain_table('energy_outages', 'eo_insert', 'eo_update', 'eo_delete');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='energy_stations') THEN
    PERFORM public.harden_domain_table('energy_stations', 'es_insert', 'es_update', 'es_delete');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='iot_sensors') THEN
    PERFORM public.harden_domain_table('iot_sensors', 'sensors_insert', 'sensors_update', 'sensors_delete');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='security_patrols') THEN
    PERFORM public.harden_domain_table('security_patrols', 'sp_insert', 'sp_update', 'sp_delete');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='traffic_accidents') THEN
    PERFORM public.harden_domain_table('traffic_accidents', 'acc_insert', 'acc_update', 'acc_delete');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='traffic_cameras') THEN
    PERFORM public.harden_domain_table('traffic_cameras', 'tcam_insert', 'tcam_update', 'tcam_delete');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='traffic_roads') THEN
    PERFORM public.harden_domain_table('traffic_roads', 'roads_insert', 'roads_update', 'roads_delete');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='waste_bins') THEN
    PERFORM public.harden_domain_table('waste_bins', 'bins_insert', 'bins_update', 'bins_delete');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='waste_collections') THEN
    PERFORM public.harden_domain_table('waste_collections', 'collections_insert', 'collections_update', 'collections_delete');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='waste_trucks') THEN
    PERFORM public.harden_domain_table('waste_trucks', 'trucks_insert', 'trucks_update', 'trucks_delete');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='water_leaks') THEN
    PERFORM public.harden_domain_table('water_leaks', 'wl_insert', 'wl_update', 'wl_delete');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='water_reservoirs') THEN
    PERFORM public.harden_domain_table('water_reservoirs', 'wr_insert', 'wr_update', 'wr_delete');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='water_stations') THEN
    PERFORM public.harden_domain_table('water_stations', 'ws_insert', 'ws_update', 'ws_delete');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ai_predictions') THEN
    PERFORM public.harden_domain_table('ai_predictions', 'ai_insert', 'ai_update', 'ai_delete');
  END IF;
END $$;

-- iot_telemetry only ever had INSERT + SELECT policies (no UPDATE/DELETE —
-- telemetry rows are immutable readings). Tighten INSERT only; ingestion
-- from real devices goes through the iot-ingest edge function, which uses
-- the service role key and bypasses RLS entirely.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='iot_telemetry') THEN
    DROP POLICY IF EXISTS "telemetry_insert" ON public.iot_telemetry;
    DROP POLICY IF EXISTS "staff_insert_iot_telemetry" ON public.iot_telemetry;
    CREATE POLICY "staff_insert_iot_telemetry" ON public.iot_telemetry FOR INSERT
      TO authenticated WITH CHECK (
        public.get_current_user_role() IN ('admin','government','ministry','province','commune','agent')
      );
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.harden_domain_table(text, text, text, text);

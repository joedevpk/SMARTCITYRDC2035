/*
# Final Stabilization Migration — Auth, Profiles, RLS, Admin CRUD

## Purpose
1. Auto-create a `profiles` row when a new auth user signs up (trigger on `auth.users`).
2. Enforce `role = 'citizen'` for self-registration — users cannot set their own role.
3. Lock down `profiles` UPDATE policy so users cannot change their own role.
4. Add admin-only INSERT/DELETE policies on profiles for admin user management.
5. Add admin CRUD policies on provinces, communes, quartiers, reports, interventions, news, notifications, gis_points, iot_devices.
6. Fix search_path on all SECURITY DEFINER functions.
7. Add `is_admin()` helper for RLS checks.

## Security
- Users can only update their own profile's non-role fields (name, phone, avatar).
- Role changes require admin/government via RPC or admin-only policy.
- All admin CRUD operations are protected by role check.
*/

-- ============================================================
-- 1. Helper function: is_admin()
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'government')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- ============================================================
-- 2. Auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Nouvel utilisateur'),
    'citizen'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated, anon;

-- ============================================================
-- 3. Profiles RLS — prevent role escalation
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile; admins can read all
DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
CREATE POLICY "select_own_profile" ON public.profiles FOR SELECT
  TO authenticated USING (
    auth.uid() = id OR public.is_admin()
  );

-- Users can update their own profile BUT NOT their role
DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile" ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      -- Only admin/government can change role
      public.is_admin()
      OR (
        -- Non-admin: role must stay the same as current
        role = (
          SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()
        )
      )
    )
  );

-- Users can insert their own profile (for the trigger or manual creation)
DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
CREATE POLICY "insert_own_profile" ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = id AND role = 'citizen'
  );

-- Admin can insert profiles (for creating admin/staff accounts)
DROP POLICY IF EXISTS "admin_insert_profile" ON public.profiles;
CREATE POLICY "admin_insert_profile" ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

-- Admin can delete profiles (deactivate users)
DROP POLICY IF EXISTS "admin_delete_profile" ON public.profiles;
CREATE POLICY "admin_delete_profile" ON public.profiles FOR DELETE
  TO authenticated USING (public.is_admin());

-- Admin can update any profile (including role changes)
DROP POLICY IF EXISTS "admin_update_profile" ON public.profiles;
CREATE POLICY "admin_update_profile" ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- 4. Admin CRUD policies on key tables
-- ============================================================

-- Provinces: public read, admin write
DROP POLICY IF EXISTS "public_read_provinces" ON public.provinces;
CREATE POLICY "public_read_provinces" ON public.provinces FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_provinces" ON public.provinces;
CREATE POLICY "admin_insert_provinces" ON public.provinces FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_provinces" ON public.provinces;
CREATE POLICY "admin_update_provinces" ON public.provinces FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_provinces" ON public.provinces;
CREATE POLICY "admin_delete_provinces" ON public.provinces FOR DELETE
  TO authenticated USING (public.is_admin());

-- Communes: public read, admin write
DROP POLICY IF EXISTS "public_read_communes" ON public.communes;
CREATE POLICY "public_read_communes" ON public.communes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_communes" ON public.communes;
CREATE POLICY "admin_insert_communes" ON public.communes FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_communes" ON public.communes;
CREATE POLICY "admin_update_communes" ON public.communes FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_communes" ON public.communes;
CREATE POLICY "admin_delete_communes" ON public.communes FOR DELETE
  TO authenticated USING (public.is_admin());

-- Quartiers: public read, admin write
DROP POLICY IF EXISTS "quartiers_read" ON public.quartiers;
CREATE POLICY "quartiers_read" ON public.quartiers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "quartiers_write" ON public.quartiers;
CREATE POLICY "quartiers_write" ON public.quartiers FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "quartiers_update" ON public.quartiers;
CREATE POLICY "quartiers_update" ON public.quartiers FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "quartiers_delete" ON public.quartiers;
CREATE POLICY "quartiers_delete" ON public.quartiers FOR DELETE
  TO authenticated USING (public.is_admin());

-- Reports: authenticated read, citizen insert own, admin update/delete
DROP POLICY IF EXISTS "auth_read_reports" ON public.reports;
CREATE POLICY "auth_read_reports" ON public.reports FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "citizen_insert_report" ON public.reports;
CREATE POLICY "citizen_insert_report" ON public.reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "admin_update_report" ON public.reports;
CREATE POLICY "admin_update_report" ON public.reports FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_report" ON public.reports;
CREATE POLICY "admin_delete_report" ON public.reports FOR DELETE
  TO authenticated USING (public.is_admin());

-- Interventions: authenticated read, admin/agent write
DROP POLICY IF EXISTS "auth_read_interventions" ON public.interventions;
CREATE POLICY "auth_read_interventions" ON public.interventions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_intervention" ON public.interventions;
CREATE POLICY "admin_insert_intervention" ON public.interventions FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_intervention" ON public.interventions;
CREATE POLICY "admin_update_intervention" ON public.interventions FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_intervention" ON public.interventions;
CREATE POLICY "admin_delete_intervention" ON public.interventions FOR DELETE
  TO authenticated USING (public.is_admin());

-- News articles: public read, admin write
DROP POLICY IF EXISTS "public_read_news" ON public.news_articles;
CREATE POLICY "public_read_news" ON public.news_articles FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_news_authenticated" ON public.news_articles;
CREATE POLICY "insert_news_authenticated" ON public.news_articles FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "update_news_authenticated" ON public.news_articles;
CREATE POLICY "update_news_authenticated" ON public.news_articles FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "delete_news_authenticated" ON public.news_articles;
CREATE POLICY "delete_news_authenticated" ON public.news_articles FOR DELETE
  TO authenticated USING (public.is_admin());

-- GIS points: public read, admin write
DROP POLICY IF EXISTS "public_read_gis" ON public.gis_points;
CREATE POLICY "public_read_gis" ON public.gis_points FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_gis" ON public.gis_points;
CREATE POLICY "auth_insert_gis" ON public.gis_points FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "auth_update_gis" ON public.gis_points;
CREATE POLICY "auth_update_gis" ON public.gis_points FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "auth_delete_gis" ON public.gis_points;
CREATE POLICY "auth_delete_gis" ON public.gis_points FOR DELETE
  TO authenticated USING (public.is_admin());

-- IoT devices: public read, admin write
DROP POLICY IF EXISTS "iot_read" ON public.iot_devices;
CREATE POLICY "iot_read" ON public.iot_devices FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "iot_insert" ON public.iot_devices;
CREATE POLICY "iot_insert" ON public.iot_devices FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "iot_update" ON public.iot_devices;
CREATE POLICY "iot_update" ON public.iot_devices FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "iot_delete" ON public.iot_devices;
CREATE POLICY "iot_delete" ON public.iot_devices FOR DELETE
  TO authenticated USING (public.is_admin());

-- Notifications: users read own, admin all
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "notifications_insert_own" ON public.notifications;
CREATE POLICY "notifications_insert_own" ON public.notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own" ON public.notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================
-- 5. Fix search_path on SECURITY DEFINER functions
-- ============================================================
ALTER FUNCTION public.check_login_attempts SET search_path TO 'public';
ALTER FUNCTION public.log_security_event SET search_path TO 'public';
ALTER FUNCTION public.log_audit_entry SET search_path TO 'public';
ALTER FUNCTION public.check_rate_limit SET search_path TO 'public';

-- Fix non-SECURITY DEFINER functions too
ALTER FUNCTION public.get_gis_points_with_coords SET search_path TO 'public';
ALTER FUNCTION public.get_devices_within_radius SET search_path TO 'public';
ALTER FUNCTION public.get_iot_devices_with_coords SET search_path TO 'public';

-- ============================================================
-- 6. Admin role update RPC (for admin dashboard)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_update_user_role(
  p_user_id uuid,
  p_new_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: admin access required';
  END IF;

  IF p_new_role NOT IN ('admin', 'government', 'ministry', 'province', 'commune',
    'police', 'emergency', 'water', 'energy', 'waste', 'transport', 'agent', 'citizen') THEN
    RAISE EXCEPTION 'Invalid role: %', p_new_role;
  END IF;

  UPDATE public.profiles SET role = p_new_role::user_role, updated_at = now()
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_user_role TO authenticated;

-- ============================================================
-- 7. Admin toggle user active status RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_toggle_user_active(
  p_user_id uuid,
  p_active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: admin access required';
  END IF;

  UPDATE public.profiles SET is_active = p_active, updated_at = now()
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_toggle_user_active TO authenticated;

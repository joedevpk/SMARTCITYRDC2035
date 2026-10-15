/*
# Fix profiles RLS recursion + ensure admin RPC functions are secure

## Problem
The `update_own_profile` policy on `profiles` contains a subquery:
  `role = (SELECT p.role FROM profiles p WHERE p.id = auth.uid())`
This subquery runs under the user's RLS context, which calls `is_admin()` →
which queries `profiles` again → infinite recursion.

## Fix
1. Replace the recursive subquery in `update_own_profile` WITH CHECK
   with a call to `get_current_user_role()` (SECURITY DEFINER, bypasses RLS).
2. Ensure `is_admin()` and `get_current_user_role()` are SECURITY DEFINER
   with safe search_path.
3. Ensure `admin_update_user_role` and `admin_toggle_user_active` RPCs
   have proper grants and search_path.
4. Ensure `log_security_event` and `check_login_attempts` are non-blocking safe.

## Security
- Citizens can only update their own profile row (auth.uid() = id).
- Citizens cannot change their own role — the WITH CHECK enforces
  that the new role must equal the current role (via SECURITY DEFINER fn).
- Admins can update any profile (is_admin() = true).
- Role changes go through `admin_update_user_role` RPC (SECURITY DEFINER)
  which checks is_admin() server-side.
*/

-- 1. Ensure helper functions are SECURITY DEFINER with safe search_path
ALTER FUNCTION public.get_current_user_role() SECURITY DEFINER;
ALTER FUNCTION public.is_admin() SECURITY DEFINER;
ALTER FUNCTION public.get_current_user_role() SET search_path = public;
ALTER FUNCTION public.is_admin() SET search_path = public;

-- 2. Fix the recursive update_own_profile policy
DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      is_admin()
      OR role = get_current_user_role()::user_role
    )
  );

-- 3. Ensure admin RPCs have grants and safe search_path
ALTER FUNCTION public.admin_update_user_role(uuid, text) SECURITY DEFINER;
ALTER FUNCTION public.admin_update_user_role(uuid, text) SET search_path = public;
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(uuid, text) TO authenticated;

ALTER FUNCTION public.admin_toggle_user_active(uuid, boolean) SECURITY DEFINER;
ALTER FUNCTION public.admin_toggle_user_active(uuid, boolean) SET search_path = public;
GRANT EXECUTE ON FUNCTION public.admin_toggle_user_active(uuid, boolean) TO authenticated;

-- 4. Ensure log_security_event and check_login_attempts are non-blocking safe
ALTER FUNCTION public.log_security_event(text, uuid, text, text, jsonb, text) SECURITY DEFINER;
ALTER FUNCTION public.log_security_event(text, uuid, text, text, jsonb, text) SET search_path = public;
GRANT EXECUTE ON FUNCTION public.log_security_event(text, uuid, text, text, jsonb, text) TO authenticated;

ALTER FUNCTION public.check_login_attempts(text, integer, integer) SECURITY DEFINER;
ALTER FUNCTION public.check_login_attempts(text, integer, integer) SET search_path = public;
GRANT EXECUTE ON FUNCTION public.check_login_attempts(text, integer, integer) TO authenticated;

-- Fix: infinite recursion in profiles RLS policies
-- The admin_select_all_profiles policy queried profiles inside its own SELECT policy,
-- causing "infinite recursion detected in policy for relation 'profiles'".
--
-- Solution: Replace the self-referencing subquery with a SECURITY DEFINER function
-- that reads the role without triggering RLS recursion.

-- Function to get the current user's role WITHOUT RLS (security definer)
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$;

-- Drop the recursive policy
DROP POLICY IF EXISTS "admin_select_all_profiles" ON public.profiles;

-- Recreate without recursion: use the SECURITY DEFINER function instead of a subquery
CREATE POLICY "admin_select_all_profiles" ON profiles FOR SELECT
  TO authenticated USING (
    public.get_current_user_role() IN ('admin', 'government')
  );

-- Grant execute on the helper function to authenticated users
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;

-- Also add an INSERT policy for profiles so registration can create a profile row
-- (the register page upserts a profile after signUp)
DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

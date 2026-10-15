/*
# Security Hardening Fix — login_attempts & security_events RLS

## Purpose
The existing 010_security_hardening migration was empty. The tables, RPC
functions, and indexes already exist in the database (created by an earlier
run), but the RLS policies are too permissive: any authenticated user can
read ALL rows of login_attempts and security_events.

## Changes
1. login_attempts
   - SELECT: a user sees only rows where identifier matches their own email,
     OR the user is admin/government (full access).
   - INSERT: any authenticated or anon user may insert (login attempts must
     be logged before/without a session).
   - DELETE: restricted to admin/government (cleanup).
2. security_events
   - SELECT: a user sees only rows where user_id = auth.uid(), OR the user is
     admin/government (full access).
   - INSERT: any authenticated or anon user may insert (security events may
     be logged before a session, e.g. failed_login).
3. Helper function
   - get_current_user_role() already exists (created in migration 012). It is
     SECURITY DEFINER so it reads the role without triggering RLS recursion.

## Security
- RLS stays ENABLED on both tables.
- Citizens can only see their own data.
- Admin/Government have full read access for auditing.
- No destructive operations; policies are dropped then recreated (idempotent).
*/

-- Ensure RLS is enabled
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- ---------- login_attempts ----------
DROP POLICY IF EXISTS "login_attempts_read" ON public.login_attempts;
CREATE POLICY "login_attempts_read" ON public.login_attempts FOR SELECT
  TO authenticated USING (
    identifier = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
    OR public.get_current_user_role() IN ('admin', 'government')
  );

DROP POLICY IF EXISTS "login_attempts_insert" ON public.login_attempts;
CREATE POLICY "login_attempts_insert" ON public.login_attempts FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "login_attempts_delete" ON public.login_attempts;
CREATE POLICY "login_attempts_delete" ON public.login_attempts FOR DELETE
  TO authenticated USING (
    public.get_current_user_role() IN ('admin', 'government')
  );

-- ---------- security_events ----------
DROP POLICY IF EXISTS "security_events_read" ON public.security_events;
CREATE POLICY "security_events_read" ON public.security_events FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR public.get_current_user_role() IN ('admin', 'government')
  );

DROP POLICY IF EXISTS "security_events_insert" ON public.security_events;
CREATE POLICY "security_events_insert" ON public.security_events FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- Ensure indexes exist (idempotent)
CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON public.login_attempts (identifier, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created ON public.login_attempts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON public.security_events (user_id, created_at DESC);

-- Grant execute on RPC functions (idempotent)
GRANT EXECUTE ON FUNCTION public.check_login_attempts TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.log_security_event TO authenticated, anon;

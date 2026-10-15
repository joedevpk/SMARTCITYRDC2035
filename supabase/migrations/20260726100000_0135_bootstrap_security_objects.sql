/*
# Bootstrap missing security objects (login_attempts, security_events,
# api_rate_limits, api_keys, and their RPC functions)

## Problem
Migrations 014, 018 and 019 all reference the tables `login_attempts` and
`security_events`, and the functions `check_login_attempts`,
`log_security_event`, `check_rate_limit` and `log_audit_entry` — via
ALTER TABLE / ALTER FUNCTION / CREATE POLICY statements. None of those
tables or functions were ever created by a CREATE TABLE / CREATE FUNCTION
statement in this migration history: they were created ad-hoc in the
Supabase SQL editor on the original project and never captured as a
migration. On a fresh project (a clean `supabase db reset`, or a brand
new Supabase project — exactly what you get when you redeploy this repo
for a demo), migration 014 fails immediately on its very first statement
(`ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY` — table
does not exist), which aborts the whole migration run and leaves every
later migration (015–020) unapplied. That breaks role security, the
profiles auto-provisioning trigger, and every RLS policy meant to lock
the platform down.

## Fix
Create every missing object here, BEFORE migration 014 runs (this file's
timestamp sorts immediately after 013 and before 014). Everything uses
`IF NOT EXISTS` / `CREATE OR REPLACE`, so it is a safe no-op against a
database where these objects already exist (e.g. the original project).

## Security
- login_attempts / security_events: created with RLS enabled and a
  temporary permissive policy so login still works; migration 014
  (which runs right after this one) replaces these with the intended
  restrictive policies.
- api_keys / api_rate_limits: nothing in the application (frontend or
  edge functions) reads or writes these tables. They are created here
  locked down by default — RLS enabled, no policies for `anon` or
  `authenticated` — so only the service role can touch them. If you
  later wire up real API-key management, add explicit admin-only
  policies at that point.
*/

-- pgcrypto provides crypt()/gen_salt() (used by migration 017 to set demo
-- passwords) and is what gen_random_uuid() relies on. Supabase projects
-- ship it enabled by default, but declaring it explicitly makes this
-- migration chain self-contained instead of depending on that default.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. login_attempts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id bigserial PRIMARY KEY,
  identifier text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "login_attempts_insert" ON public.login_attempts;
CREATE POLICY "login_attempts_insert" ON public.login_attempts FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- ============================================================
-- 2. security_events
-- ============================================================
CREATE TABLE IF NOT EXISTS public.security_events (
  id bigserial PRIMARY KEY,
  event_type text NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ip_address text,
  user_agent text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  severity text NOT NULL DEFAULT 'info',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "security_events_insert" ON public.security_events;
CREATE POLICY "security_events_insert" ON public.security_events FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- ============================================================
-- 3. api_rate_limits (not used by the app today; created locked down
--    so check_rate_limit() below has somewhere to write, and so the
--    orphaned wide-open policies seen in older exports never resurface)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id bigserial PRIMARY KEY,
  key text NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_key ON public.api_rate_limits (key, window_start DESC);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies on purpose — service role only.
DROP POLICY IF EXISTS "rate_limit_delete" ON public.api_rate_limits;
DROP POLICY IF EXISTS "rate_limit_insert" ON public.api_rate_limits;
DROP POLICY IF EXISTS "rate_limit_read" ON public.api_rate_limits;
DROP POLICY IF EXISTS "rate_limit_update" ON public.api_rate_limits;

-- ============================================================
-- 4. api_keys (not used by the app today; created locked down for the
--    same reason as api_rate_limits above)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key_hash text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies on purpose — service role only.
DROP POLICY IF EXISTS "api_keys_delete" ON public.api_keys;
DROP POLICY IF EXISTS "api_keys_insert" ON public.api_keys;
DROP POLICY IF EXISTS "api_keys_read" ON public.api_keys;
DROP POLICY IF EXISTS "api_keys_update" ON public.api_keys;

-- ============================================================
-- 5. check_login_attempts(identifier, max_attempts, window_minutes)
--    Called from the login page before every sign-in attempt.
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_login_attempts(
  p_identifier text,
  p_max_attempts integer DEFAULT 5,
  p_window_minutes integer DEFAULT 15
)
RETURNS TABLE(locked boolean, attempts integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    count(*) FILTER (WHERE success = false) >= p_max_attempts AS locked,
    count(*) FILTER (WHERE success = false)::integer AS attempts
  FROM public.login_attempts
  WHERE identifier = p_identifier
    AND created_at > now() - make_interval(mins => p_window_minutes);
$$;

GRANT EXECUTE ON FUNCTION public.check_login_attempts(text, integer, integer) TO authenticated, anon;

-- ============================================================
-- 6. log_security_event(event_type, user_id, ip, agent, details, severity)
--    Called from the login page after every sign-in attempt.
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type text,
  p_user_id uuid,
  p_ip text,
  p_agent text,
  p_details jsonb DEFAULT '{}'::jsonb,
  p_severity text DEFAULT 'info'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.security_events (event_type, user_id, ip_address, user_agent, details, severity)
  VALUES (p_event_type, p_user_id, NULLIF(p_ip, ''), p_agent, COALESCE(p_details, '{}'::jsonb), COALESCE(p_severity, 'info'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_security_event(text, uuid, text, text, jsonb, text) TO authenticated, anon;

-- ============================================================
-- 7. check_rate_limit(key, max_requests, window_seconds)
--    Not currently called by the app; provided so any future edge
--    function can use it, and so migration 018's ALTER FUNCTION
--    statement has a real function to target.
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text,
  p_max_requests integer DEFAULT 60,
  p_window_seconds integer DEFAULT 60
)
RETURNS TABLE(allowed boolean, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COALESCE(sum(request_count), 0) INTO v_count
  FROM public.api_rate_limits
  WHERE key = p_key
    AND window_start > now() - make_interval(secs => p_window_seconds);

  INSERT INTO public.api_rate_limits (key, request_count, window_start)
  VALUES (p_key, 1, now());

  RETURN QUERY SELECT
    (v_count + 1) <= p_max_requests,
    GREATEST(p_max_requests - (v_count + 1), 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO authenticated, anon;

-- ============================================================
-- 8. log_audit_entry(actor_id, action, entity_type, entity_id, details, ip)
--    Not currently called by the app; provided so admin actions have a
--    ready-made audit helper, and so migration 018's ALTER FUNCTION
--    statement has a real function to target.
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_audit_entry(
  p_actor_id uuid,
  p_action text,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb,
  p_ip text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, details, ip_address)
  VALUES (p_actor_id, p_action, p_entity_type, p_entity_id, COALESCE(p_details, '{}'::jsonb), NULLIF(p_ip, ''));
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audit_entry(uuid, text, text, uuid, jsonb, text) TO authenticated;

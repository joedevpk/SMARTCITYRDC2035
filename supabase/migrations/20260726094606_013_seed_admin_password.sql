/*
# Seed Admin Password — Secure

## Purpose
Ensures the admin account has a password set for development/testing.
The password is NEVER stored in plaintext in this migration.

## Logic
1. Reads ADMIN_SEED_PASSWORD from the current environment (app.admin_seed_password setting).
2. If not set, generates a random 24-char password using gen_random_bytes().
3. Hashes it with bcrypt and stores the hash in auth.users.
4. (Fixed 2026-10-13) The password is no longer printed; the original `DO $` delimiter was a syntax error.

## Security
- No plaintext password in source control.
- Password is hashed with bcrypt (gen_salt('bf')).
- In production, set ADMIN_SEED_PASSWORD env var before running migrations.
*/

DO $$
DECLARE
  v_password text;
  v_hash text;
BEGIN
  v_password := current_setting('app.admin_seed_password', true);

  IF v_password IS NULL OR v_password = '' THEN
    v_password := encode(gen_random_bytes(24), 'base64');
    v_password := replace(replace(v_password, chr(10), ''), chr(13), '');
  END IF;

  v_hash := crypt(v_password, gen_salt('bf'));

  UPDATE auth.users
  SET encrypted_password = v_hash,
      email_confirmed_at = now(),
      updated_at = now()
  WHERE email = 'admin@smartcity-rdc.cd';

  -- SECURITY: the password is never printed (migration logs are not a secret store).
  -- Reset it with the Supabase Auth "forgot password" flow or ADMIN_SEED_PASSWORD.
  RAISE NOTICE 'Email: admin@smartcity-rdc.cd';
  RAISE NOTICE 'WARNING: These are demo credentials. Do not use in production.';
END $$;

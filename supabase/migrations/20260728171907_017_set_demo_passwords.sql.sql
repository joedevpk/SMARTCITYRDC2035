/*
# Set Demo Passwords

## Purpose
All demo accounts on the login page use password "demo1234" for quick-login.
The original admin password was auto-generated and unknown. This migration
sets all 7 demo accounts to the known demo password.

## Security
- This is for development/demo only. In production, ADMIN_SEED_PASSWORD
  should be set and this migration skipped or overridden.
- Passwords are hashed with bcrypt (gen_salt('bf')).
*/

DO $$
DECLARE
  v_hash text;
  v_emails text[] := ARRAY[
    'admin@smartcity-rdc.cd',
    'government@smartcity-rdc.cd',
    'ministry@smartcity-rdc.cd',
    'province@smartcity-rdc.cd',
    'commune@smartcity-rdc.cd',
    'agent@smartcity-rdc.cd',
    'citizen@smartcity-rdc.cd'
  ];
  v_email text;
BEGIN
  -- SECURITY (2026-10-13): a publicly known password must never be set by default.
  -- Opt in explicitly on a throw-away database only:  ALTER DATABASE postgres SET app.allow_demo_passwords = 'on';
  IF COALESCE(current_setting('app.allow_demo_passwords', true), 'off') <> 'on' THEN
    RAISE NOTICE 'Demo passwords NOT set (app.allow_demo_passwords is off).';
    RETURN;
  END IF;
  v_hash := crypt('demo1234', gen_salt('bf'));

  FOREACH v_email IN ARRAY v_emails LOOP
    UPDATE auth.users
    SET encrypted_password = v_hash,
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE email = v_email;
  END LOOP;

  RAISE NOTICE 'Demo passwords set for % accounts', array_length(v_emails, 1);
END $$;

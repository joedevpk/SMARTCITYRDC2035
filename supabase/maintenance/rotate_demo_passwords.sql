-- MANUAL, NOT A MIGRATION. Run once in the SQL editor of any environment where migration 017 already ran
-- (it set the public password "demo1234" on the 7 demo accounts). Replace the placeholder first.
-- Do not commit a real password into this file.
DO $$
DECLARE v_pwd text := 'REPLACE_WITH_A_LONG_RANDOM_PASSWORD_AT_LEAST_20_CHARS';
BEGIN
  IF v_pwd LIKE 'REPLACE_WITH%' THEN RAISE EXCEPTION 'Set a real password first'; END IF;
  UPDATE auth.users SET encrypted_password = crypt(v_pwd, gen_salt('bf')), updated_at = now()
  WHERE email LIKE '%@smartcity-rdc.cd';
END $$;
-- Alternative for production: DELETE the demo users from the Auth dashboard.

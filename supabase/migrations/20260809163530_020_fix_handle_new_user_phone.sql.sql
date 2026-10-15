/*
# Fix handle_new_user trigger to store phone from user metadata

## Problem
The register page sends `full_name` in user metadata, but the trigger
only reads `full_name`. The phone number is sent separately via a
profiles UPDATE after signup, which fails when email confirmation is
enabled (no session = no auth.uid() = RLS blocks the update).

## Fix
1. Update `handle_new_user` to also read `phone` from raw_user_meta_data.
2. This way the profile is fully populated at signup time, including phone.
3. The register page no longer needs to do a separate UPDATE after signup.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Nouvel utilisateur'),
    NEW.raw_user_meta_data->>'phone',
    'citizen'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated, anon;

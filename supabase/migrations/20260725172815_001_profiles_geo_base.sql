/*
# Profiles, Provinces, Communes — RBAC foundation

## Purpose
Establishes the user profile system with role-based access control (RBAC) and the geographic base tables (provinces and communes) that all other modules reference.

## New Tables

### provinces (created first — referenced by others)
- `id` (uuid, PK)
- `name` (text, unique) — province name
- `code` (text, unique) — short code
- `capital` (text) — capital city
- `population` (integer)
- `location` (geometry(Point, 4326), nullable)
- `created_at` (timestamptz)

### communes
- `id` (uuid, PK)
- `name` (text)
- `province_id` (uuid, FK) — parent province
- `population` (integer)
- `location` (geometry(Point, 4326), nullable)
- `created_at` (timestamptz)
- Unique constraint on (name, province_id)

### profiles
- `id` (uuid, PK, FK to auth.users) — one row per authenticated user
- `full_name` (text) — display name
- `phone` (text, nullable)
- `role` (enum) — one of: admin, government, ministry, province, commune, police, agent, citizen
- `province_id` (uuid, nullable, FK)
- `commune_id` (uuid, nullable, FK)
- `avatar_url` (text, nullable)
- `is_active` (boolean, default true)
- `created_at`, `updated_at` (timestamptz)

## Security (RLS)
- profiles: users read/update own; admins read all
- provinces & communes: public read (anon + authenticated)

## Notes
1. Uses PostGIS geometry type for location data
2. Role enum enforces the 8 RBAC roles
3. Province/commune references enable territory-scoped permissions
*/

-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Role enum
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'admin', 'government', 'ministry', 'province', 'commune', 'police', 'agent', 'citizen'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Provinces table (first — referenced by communes & profiles)
CREATE TABLE IF NOT EXISTS provinces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  capital text,
  population integer DEFAULT 0,
  location geometry(Point, 4326),
  created_at timestamptz DEFAULT now()
);

-- Communes table
CREATE TABLE IF NOT EXISTS communes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  province_id uuid NOT NULL REFERENCES provinces(id) ON DELETE CASCADE,
  population integer DEFAULT 0,
  location geometry(Point, 4326),
  created_at timestamptz DEFAULT now(),
  UNIQUE (name, province_id)
);

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  role user_role NOT NULL DEFAULT 'citizen',
  province_id uuid REFERENCES provinces(id) ON DELETE SET NULL,
  commune_id uuid REFERENCES communes(id) ON DELETE SET NULL,
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_province ON profiles(province_id);
CREATE INDEX IF NOT EXISTS idx_communes_province ON communes(province_id);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE provinces ENABLE ROW LEVEL SECURITY;
ALTER TABLE communes ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "admin_select_all_profiles" ON profiles;
CREATE POLICY "admin_select_all_profiles" ON profiles FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','government'))
  );

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Provinces: public read
DROP POLICY IF EXISTS "public_read_provinces" ON provinces;
CREATE POLICY "public_read_provinces" ON provinces FOR SELECT
  TO anon, authenticated USING (true);

-- Communes: public read
DROP POLICY IF EXISTS "public_read_communes" ON communes;
CREATE POLICY "public_read_communes" ON communes FOR SELECT
  TO anon, authenticated USING (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated ON profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

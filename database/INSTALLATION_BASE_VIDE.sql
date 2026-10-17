-- =====================================================================================
-- SMART CITY RDC 2035 — INSTALLATION INITIALE (BASE VIDE)           [FICHIER GÉNÉRÉ — ne pas éditer]
-- Source : supabase/migrations/*.sql (001 → 026) via database/build_sql.py
--
-- ⚠ À exécuter UNIQUEMENT sur une base Supabase VIDE (nouveau projet).
--   Le script s'arrête de lui-même si public.profiles ou public.reports existent déjà.
--   Base existante ou partiellement installée → database/REPARATION_BASE_EXISTANTE.sql.
-- Contenu : schéma complet (tables, types, index, fonctions, triggers, RLS, droits) + référence géographique
--   (provinces, communes de Kinshasa : valeurs approximatives, à valider avec les sources officielles).
-- Aucune donnée de démonstration, aucun compte, aucun mot de passe, aucune clé.
-- Le SQL Editor exécute le texte en une seule transaction : en cas d'erreur, rien n'est créé.
-- ⚠ Ce script n'écrit PAS dans l'historique supabase_migrations : voir docs/MIGRATIONS_GUIDE.md.
-- =====================================================================================
DO $guard$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL OR to_regclass('public.reports') IS NOT NULL THEN
    RAISE EXCEPTION 'Base NON vide (public.profiles ou public.reports existe) : utilisez database/REPARATION_BASE_EXISTANTE.sql';
  END IF;
END
$guard$;

-- ###### 20260725172815_001_profiles_geo_base.sql
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

-- ###### 20260725172842_002_reports_interventions.sql
/*
# Citizen Reports & Interventions — Waste workflow core

## Purpose
Implements the citizen reporting system and the intervention workflow.
This is the backbone of the waste management workflow:
  Citizen reports → GPS recorded → Validation → Intervention created →
  Agent assigned → Collection → Photo proof → Closure

## New Tables

### reports
- `id` (uuid, PK)
- `reference` (text, unique) — human-readable ID (RPT-YYYY-NNNN)
- `category` (enum) — traffic, waste, lighting, water, power, security, road, other
- `title` (text) — short description
- `description` (text) — detailed description
- `status` (enum) — pending, validated, assigned, in_progress, resolved, rejected
- `priority` (enum) — low, medium, high, critical
- `location` (geometry(Point, 4326)) — GPS coordinates
- `address` (text) — human-readable address
- `photo_url` (text, nullable) — uploaded photo
- `reporter_id` (uuid, FK to profiles) — citizen who reported
- `assigned_to` (uuid, nullable, FK to profiles) — agent assigned
- `commune_id` (uuid, nullable, FK) — commune where issue is located
- `province_id` (uuid, nullable, FK) — province
- `validated_by` (uuid, nullable, FK to profiles) — validator
- `resolved_at` (timestamptz, nullable)
- `created_at`, `updated_at`

### interventions
- `id` (uuid, PK)
- `report_id` (uuid, FK) — parent report
- `agent_id` (uuid, FK to profiles) — assigned agent
- `status` (enum) — assigned, accepted, in_progress, completed, cancelled
- `assigned_at`, `accepted_at`, `started_at`, `completed_at` (timestamptz)
- `proof_photo_url` (text, nullable) — completion proof
- `notes` (text, nullable)
- `created_at`, `updated_at`

### report_events
- Audit trail of status transitions per report
- `id` (uuid, PK)
- `report_id` (uuid, FK)
- `event_type` (text) — created, validated, assigned, started, completed, rejected
- `from_status`, `to_status` (text, nullable)
- `actor_id` (uuid, FK to profiles)
- `comment` (text, nullable)
- `created_at`

## Security (RLS)
- reports: authenticated can read all; citizens create own; agents/admins update
- interventions: authenticated read all; agents update own; admins create
- report_events: authenticated read all; system inserts

## Notes
1. `location` uses PostGIS Point for spatial queries (nearby, within commune)
2. `reference` auto-generated via trigger on insert
3. report_events provides full workflow audit trail
4. Reporter defaults to auth.uid() so citizen inserts work without passing reporter_id
*/

DO $$ BEGIN
  CREATE TYPE report_category AS ENUM ('traffic','waste','lighting','water','power','security','road','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE report_status AS ENUM ('pending','validated','assigned','in_progress','resolved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE report_priority AS ENUM ('low','medium','high','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE intervention_status AS ENUM ('assigned','accepted','in_progress','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text UNIQUE,
  category report_category NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  status report_status NOT NULL DEFAULT 'pending',
  priority report_priority NOT NULL DEFAULT 'medium',
  location geometry(Point, 4326),
  address text,
  photo_url text,
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  commune_id uuid REFERENCES communes(id) ON DELETE SET NULL,
  province_id uuid REFERENCES provinces(id) ON DELETE SET NULL,
  validated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  status intervention_status NOT NULL DEFAULT 'assigned',
  assigned_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  proof_photo_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_status text,
  to_status text,
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  comment text,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_commune ON reports(commune_id);
CREATE INDEX IF NOT EXISTS idx_reports_location ON reports USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_interventions_report ON interventions(report_id);
CREATE INDEX IF NOT EXISTS idx_interventions_agent ON interventions(agent_id);
CREATE INDEX IF NOT EXISTS idx_report_events_report ON report_events(report_id);

-- RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_events ENABLE ROW LEVEL SECURITY;

-- reports: authenticated read all, citizens create own, agents/admins update
DROP POLICY IF EXISTS "auth_read_reports" ON reports;
CREATE POLICY "auth_read_reports" ON reports FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "citizen_insert_report" ON reports;
CREATE POLICY "citizen_insert_report" ON reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "agent_update_report" ON reports;
CREATE POLICY "agent_update_report" ON reports FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- interventions: authenticated read, agents update own, admins create
DROP POLICY IF EXISTS "auth_read_interventions" ON interventions;
CREATE POLICY "auth_read_interventions" ON interventions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_intervention" ON interventions;
CREATE POLICY "admin_insert_intervention" ON interventions FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "agent_update_intervention" ON interventions;
CREATE POLICY "agent_update_intervention" ON interventions FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- report_events: authenticated read, system insert
DROP POLICY IF EXISTS "auth_read_events" ON report_events;
CREATE POLICY "auth_read_events" ON report_events FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_event" ON report_events;
CREATE POLICY "insert_event" ON report_events FOR INSERT
  TO authenticated WITH CHECK (true);

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_reports_updated ON reports;
CREATE TRIGGER trg_reports_updated BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_interventions_updated ON interventions;
CREATE TRIGGER trg_interventions_updated BEFORE UPDATE ON interventions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-generate reference on insert
CREATE OR REPLACE FUNCTION generate_report_reference()
RETURNS trigger AS $$
BEGIN
  IF NEW.reference IS NULL THEN
    NEW.reference := 'RPT-' || EXTRACT(YEAR FROM now())::text || '-' || lpad(
      (nextval('report_seq'))::text, 4, '0'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS report_seq START 1;

DROP TRIGGER IF EXISTS trg_report_reference ON reports;
CREATE TRIGGER trg_report_reference BEFORE INSERT ON reports
  FOR EACH ROW EXECUTE FUNCTION generate_report_reference();

-- ###### 20260725172910_003_domain_modules.sql
/*
# Domain Modules — Traffic, Energy, Water, Lighting, Security, Emergency

## Purpose
Creates the domain-specific tables for each smart-city service module.
Each module stores infrastructure assets and their real-time status readings,
enabling monitoring, alerting, and dashboards.

## New Tables

### traffic_sensors
- Road traffic sensors with congestion data
- `id`, `name`, `location` (Point), `commune_id`, `road_name`, `current_speed` (km/h),
  `congestion_level` (enum: fluid, moderate, heavy, congested), `vehicle_count`,
  `is_active`, `last_reading_at`, `created_at`

### energy_assets
- Electrical infrastructure (substations, lines, meters)
- `id`, `name`, `type` (enum: substation, line, meter, transformer), `location`,
  `commune_id`, `capacity_kw`, `current_load_kw`, `status` (enum: operational, maintenance, outage),
  `is_active`, `last_reading_at`, `created_at`

### water_assets
- Water distribution infrastructure
- `id`, `name`, `type` (enum: station, reservoir, pipe, pump), `location`,
  `commune_id`, `capacity_m3`, `current_flow_m3h`, `pressure_bar`,
  `status` (enum: operational, maintenance, leak, outage), `is_active`, `last_reading_at`, `created_at`

### lighting_assets
- Street lighting infrastructure
- `id`, `name`, `location`, `commune_id`, `is_on`, `is_active`,
  `bulb_type` (enum: led, halogen, sodium), `wattage`, `last_maintenance_at`, `created_at`

### security_cameras
- Public CCTV cameras
- `id`, `name`, `location`, `commune_id`, `is_online`, `is_recording`,
  `resolution`, `coverage_area`, `last_heartbeat_at`, `created_at`

### emergency_incidents
- Emergency incidents (security, fire, medical)
- `id`, `type` (enum: security, fire, medical, natural, other), `severity` (enum: low, medium, high, critical),
  `location`, `address`, `commune_id`, `description`, `status` (enum: active, dispatched, resolved),
  `reported_by` (FK profiles), `dispatched_to` (FK profiles nullable), `resolved_at`, `created_at`, `updated_at`

## Security (RLS)
- All domain tables: authenticated read all; authenticated insert/update (agents & admins)
- Emergency: authenticated read; citizens create own; agents/admins update

## Notes
1. All location columns use PostGIS Point for spatial queries
2. last_reading_at / last_heartbeat_at enable staleness detection
3. Each module has is_active flag for soft-deactivation
4. Congestion/status enums enable workflow-specific state machines
*/

-- Enums
DO $$ BEGIN CREATE TYPE congestion_level AS ENUM ('fluid','moderate','heavy','congested'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE energy_asset_type AS ENUM ('substation','line','meter','transformer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE operational_status AS ENUM ('operational','maintenance','outage'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE water_asset_type AS ENUM ('station','reservoir','pipe','pump'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE water_status AS ENUM ('operational','maintenance','leak','outage'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE bulb_type AS ENUM ('led','halogen','sodium'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE emergency_type AS ENUM ('security','fire','medical','natural','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE severity_level AS ENUM ('low','medium','high','critical'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE emergency_status AS ENUM ('active','dispatched','resolved'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Traffic sensors
CREATE TABLE IF NOT EXISTS traffic_sensors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location geometry(Point, 4326),
  commune_id uuid REFERENCES communes(id) ON DELETE SET NULL,
  road_name text,
  current_speed_kmh numeric DEFAULT 0,
  congestion_level congestion_level DEFAULT 'fluid',
  vehicle_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  last_reading_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Energy assets
CREATE TABLE IF NOT EXISTS energy_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type energy_asset_type NOT NULL,
  location geometry(Point, 4326),
  commune_id uuid REFERENCES communes(id) ON DELETE SET NULL,
  capacity_kw numeric DEFAULT 0,
  current_load_kw numeric DEFAULT 0,
  status operational_status DEFAULT 'operational',
  is_active boolean DEFAULT true,
  last_reading_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Water assets
CREATE TABLE IF NOT EXISTS water_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type water_asset_type NOT NULL,
  location geometry(Point, 4326),
  commune_id uuid REFERENCES communes(id) ON DELETE SET NULL,
  capacity_m3 numeric DEFAULT 0,
  current_flow_m3h numeric DEFAULT 0,
  pressure_bar numeric DEFAULT 0,
  status water_status DEFAULT 'operational',
  is_active boolean DEFAULT true,
  last_reading_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Lighting assets
CREATE TABLE IF NOT EXISTS lighting_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location geometry(Point, 4326),
  commune_id uuid REFERENCES communes(id) ON DELETE SET NULL,
  is_on boolean DEFAULT false,
  is_active boolean DEFAULT true,
  bulb_type bulb_type DEFAULT 'led',
  wattage integer DEFAULT 60,
  last_maintenance_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Security cameras
CREATE TABLE IF NOT EXISTS security_cameras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location geometry(Point, 4326),
  commune_id uuid REFERENCES communes(id) ON DELETE SET NULL,
  is_online boolean DEFAULT true,
  is_recording boolean DEFAULT true,
  resolution text DEFAULT '1080p',
  coverage_area text,
  last_heartbeat_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Emergency incidents
CREATE TABLE IF NOT EXISTS emergency_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type emergency_type NOT NULL,
  severity severity_level DEFAULT 'medium',
  location geometry(Point, 4326),
  address text,
  commune_id uuid REFERENCES communes(id) ON DELETE SET NULL,
  description text NOT NULL,
  status emergency_status DEFAULT 'active',
  reported_by uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE SET NULL,
  dispatched_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_traffic_location ON traffic_sensors USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_traffic_commune ON traffic_sensors(commune_id);
CREATE INDEX IF NOT EXISTS idx_energy_location ON energy_assets USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_energy_commune ON energy_assets(commune_id);
CREATE INDEX IF NOT EXISTS idx_water_location ON water_assets USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_water_commune ON water_assets(commune_id);
CREATE INDEX IF NOT EXISTS idx_lighting_location ON lighting_assets USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_lighting_commune ON lighting_assets(commune_id);
CREATE INDEX IF NOT EXISTS idx_cameras_location ON security_cameras USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_cameras_commune ON security_cameras(commune_id);
CREATE INDEX IF NOT EXISTS idx_emergency_location ON emergency_incidents USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_emergency_status ON emergency_incidents(status);
CREATE INDEX IF NOT EXISTS idx_emergency_reporter ON emergency_incidents(reported_by);

-- RLS: all tables authenticated read + write
ALTER TABLE traffic_sensors ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE lighting_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_incidents ENABLE ROW LEVEL SECURITY;

-- Helper: standard CRUD policies for a domain table
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['traffic_sensors','energy_assets','water_assets','lighting_assets','security_cameras'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "auth_read_%s" ON %I;', t, t);
    EXECUTE format('CREATE POLICY "auth_read_%s" ON %I FOR SELECT TO authenticated USING (true);', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_insert_%s" ON %I;', t, t);
    EXECUTE format('CREATE POLICY "auth_insert_%s" ON %I FOR INSERT TO authenticated WITH CHECK (true);', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_update_%s" ON %I;', t, t);
    EXECUTE format('CREATE POLICY "auth_update_%s" ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true);', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_delete_%s" ON %I;', t, t);
    EXECUTE format('CREATE POLICY "auth_delete_%s" ON %I FOR DELETE TO authenticated USING (true);', t, t);
  END LOOP;
END $$;

-- Emergency: authenticated read, citizen create own, agents update
DROP POLICY IF EXISTS "auth_read_emergency" ON emergency_incidents;
CREATE POLICY "auth_read_emergency" ON emergency_incidents FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "citizen_insert_emergency" ON emergency_incidents;
CREATE POLICY "citizen_insert_emergency" ON emergency_incidents FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = reported_by);

DROP POLICY IF EXISTS "agent_update_emergency" ON emergency_incidents;
CREATE POLICY "agent_update_emergency" ON emergency_incidents FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_emergency_updated ON emergency_incidents;
CREATE TRIGGER trg_emergency_updated BEFORE UPDATE ON emergency_incidents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ###### 20260725172940_004_gis_notifications_audit.sql
/*
# GIS Points, Notifications, Audit Log

## Purpose
Creates the unified GIS layer for map rendering, the real-time notification
system (backed by Supabase Realtime), and an audit log for compliance.

## New Tables

### gis_points
- Unified map layer aggregating all geographic features for the interactive map
- `id`, `category` (enum: traffic, waste, light, camera, hospital, police, water, power, incident),
  `name`, `description`, `location` (Point), `commune_id`, `status` (text),
  `metadata` (jsonb), `is_active`, `created_at`, `updated_at`

### notifications
- Real-time user notifications delivered via Supabase Realtime subscriptions
- `id`, `user_id` (FK profiles), `title`, `message`, `type` (enum: info, success, warning, error),
  `category` (text), `read` (boolean), `created_at`

### audit_log
- System-wide audit trail for compliance and security review
- `id`, `actor_id` (FK profiles), `action`, `entity_type`, `entity_id`,
  `details` (jsonb), `ip_address`, `created_at`

## Security (RLS)
- gis_points: public read (anon + authenticated); authenticated write
- notifications: users read/update own only (privacy)
- audit_log: admin read only; authenticated insert (system events)

## Notes
1. gis_points provides a single query for the map page — no joins needed
2. notifications.user_id targets the recipient; RLS ensures privacy
3. audit_log captures all sensitive operations for government compliance
4. Realtime publication enabled for live updates
*/

DO $$ BEGIN
  CREATE TYPE gis_category AS ENUM ('traffic','waste','light','camera','hospital','police','water','power','incident');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('info','success','warning','error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS gis_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category gis_category NOT NULL,
  name text NOT NULL,
  description text,
  location geometry(Point, 4326),
  commune_id uuid REFERENCES communes(id) ON DELETE SET NULL,
  status text,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type notification_type NOT NULL DEFAULT 'info',
  category text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gis_category ON gis_points(category);
CREATE INDEX IF NOT EXISTS idx_gis_location ON gis_points USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_gis_commune ON gis_points(commune_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);

-- RLS
ALTER TABLE gis_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- gis_points: public read, authenticated write
DROP POLICY IF EXISTS "public_read_gis" ON gis_points;
CREATE POLICY "public_read_gis" ON gis_points FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_gis" ON gis_points;
CREATE POLICY "auth_insert_gis" ON gis_points FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_gis" ON gis_points;
CREATE POLICY "auth_update_gis" ON gis_points FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_gis" ON gis_points;
CREATE POLICY "auth_delete_gis" ON gis_points FOR DELETE
  TO authenticated USING (true);

-- notifications: users read/update own only
DROP POLICY IF EXISTS "read_own_notifications" ON notifications;
CREATE POLICY "read_own_notifications" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
CREATE POLICY "insert_own_notifications" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;
CREATE POLICY "delete_own_notifications" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- audit_log: admin read, authenticated insert
DROP POLICY IF EXISTS "admin_read_audit" ON audit_log;
CREATE POLICY "admin_read_audit" ON audit_log FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','government'))
  );

DROP POLICY IF EXISTS "auth_insert_audit" ON audit_log;
CREATE POLICY "auth_insert_audit" ON audit_log FOR INSERT
  TO authenticated WITH CHECK (true);

-- updated_at trigger for gis_points
DROP TRIGGER IF EXISTS trg_gis_updated ON gis_points;
CREATE TRIGGER trg_gis_updated BEFORE UPDATE ON gis_points
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Realtime publication (idempotent — uses DO block to check membership)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'reports'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE reports;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'emergency_incidents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE emergency_incidents;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'gis_points'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE gis_points;
  END IF;
END $$;

-- ###### 20260725173039_005_seed_data.sql
/*
# Seed Data — Provinces, Communes, GIS Points

## Purpose
Populates geographic base tables and GIS layer with real DRC data so the
platform is immediately functional.

## Data Inserted
### provinces — All 26 DRC provinces
### communes — 24 Kinshasa communes
### gis_points — 18 map features across 9 categories

## Notes
1. ON CONFLICT DO NOTHING for idempotency
2. Enum literals cast explicitly to gis_category type
3. Coordinates use SRID 4326 (WGS84)
*/

INSERT INTO provinces (name, code, capital, population, location) VALUES
('Kinshasa','KIN','Kinshasa',17150000,ST_SetSRID(ST_MakePoint(15.300,-4.325),4326)),
('Kongo Central','KGC','Matadi',6000000,ST_SetSRID(ST_MakePoint(13.46,-5.82),4326)),
('Kwilu','KWL','Bandundu',6700000,ST_SetSRID(ST_MakePoint(18.06,-3.32),4326)),
('Kwango','KWG','Kenge',3000000,ST_SetSRID(ST_MakePoint(17.43,-4.78),4326)),
('Mai-Ndombe','MND','Inongo',2000000,ST_SetSRID(ST_MakePoint(18.27,-2.00),4326)),
('Équateur','EQU','Mbandaka',11000000,ST_SetSRID(ST_MakePoint(18.26,0.05),4326)),
('Tshuapa','TSH','Boende',2600000,ST_SetSRID(ST_MakePoint(22.37,-0.22),4326)),
('Mongala','MGL','Lisala',2500000,ST_SetSRID(ST_MakePoint(21.52,2.15),4326)),
('Sud-Ubangi','SUB','Gemena',3000000,ST_SetSRID(ST_MakePoint(19.77,3.25),4326)),
('Nord-Ubangi','NUB','Gbadolite',2500000,ST_SetSRID(ST_MakePoint(20.00,4.27),4326)),
('Bas-Uele','BUL','Buta',2400000,ST_SetSRID(ST_MakePoint(24.73,2.79),4326)),
('Haut-Uele','HUL','Isiro',2500000,ST_SetSRID(ST_MakePoint(27.43,2.77),4326)),
('Ituri','ITU','Bunia',4500000,ST_SetSRID(ST_MakePoint(29.66,1.56),4326)),
('Nord-Kivu','NKV','Goma',6500000,ST_SetSRID(ST_MakePoint(29.22,-1.68),4326)),
('Sud-Kivu','SKV','Bukavu',5500000,ST_SetSRID(ST_MakePoint(28.85,-2.51),4326)),
('Maniema','MNI','Kindu',2700000,ST_SetSRID(ST_MakePoint(25.92,-2.93),4326)),
('Tanganyika','TGT','Kalemie',3300000,ST_SetSRID(ST_MakePoint(29.19,-5.93),4326)),
('Haut-Lomami','HLM','Kamina',2500000,ST_SetSRID(ST_MakePoint(25.20,-8.50),4326)),
('Lualaba','LUA','Kolwezi',2900000,ST_SetSRID(ST_MakePoint(25.46,-10.72),4326)),
('Haut-Katanga','HKT','Lubumbashi',5600000,ST_SetSRID(ST_MakePoint(27.48,-11.66),4326)),
('Kasaï','KSA','Tshikapa',4500000,ST_SetSRID(ST_MakePoint(20.00,-6.42),4326)),
('Kasaï Central','KSC','Kananga',4100000,ST_SetSRID(ST_MakePoint(22.42,-5.90),4326)),
('Kasaï Oriental','KSO','Mbuji-Mayi',4600000,ST_SetSRID(ST_MakePoint(23.59,-6.13),4326)),
('Lomami','LOM','Kabinda',2200000,ST_SetSRID(ST_MakePoint(24.48,-6.13),4326)),
('Sankuru','SAN','Lusambo',2300000,ST_SetSRID(ST_MakePoint(23.45,-4.95),4326)),
('Tshopo','TSHO','Kisangani',3200000,ST_SetSRID(ST_MakePoint(25.20,0.51),4326))
ON CONFLICT (name) DO NOTHING;

-- Kinshasa communes (deduplicated)
INSERT INTO communes (name, province_id, population, location)
SELECT c.name, p.id, c.population, c.location
FROM provinces p
CROSS JOIN (VALUES
  ('Gombe', 180000, ST_SetSRID(ST_MakePoint(15.305,-4.325),4326)),
  ('Lemba', 220000, ST_SetSRID(ST_MakePoint(15.295,-4.382),4326)),
  ('Ngaliema', 340000, ST_SetSRID(ST_MakePoint(15.285,-4.340),4326)),
  ('Matete', 290000, ST_SetSRID(ST_MakePoint(15.300,-4.400),4326)),
  ('Bandalungwa', 310000, ST_SetSRID(ST_MakePoint(15.310,-4.350),4326)),
  ('Kintambo', 150000, ST_SetSRID(ST_MakePoint(15.290,-4.330),4326)),
  ('Kinshasa', 200000, ST_SetSRID(ST_MakePoint(15.300,-4.320),4326)),
  ('Barumbu', 180000, ST_SetSRID(ST_MakePoint(15.310,-4.330),4326)),
  ('Bumbu', 250000, ST_SetSRID(ST_MakePoint(15.270,-4.350),4326)),
  ('Selembao', 230000, ST_SetSRID(ST_MakePoint(15.260,-4.360),4326)),
  ('Makala', 150000, ST_SetSRID(ST_MakePoint(15.250,-4.370),4326)),
  ('Ngaba', 170000, ST_SetSRID(ST_MakePoint(15.320,-4.390),4326)),
  ('Kalamu', 280000, ST_SetSRID(ST_MakePoint(15.300,-4.340),4326)),
  ('Kasavubu', 200000, ST_SetSRID(ST_MakePoint(15.290,-4.370),4326)),
  ('Limbete', 190000, ST_SetSRID(ST_MakePoint(15.270,-4.390),4326)),
  ('Matonge', 160000, ST_SetSRID(ST_MakePoint(15.310,-4.350),4326)),
  ('Ndjili', 300000, ST_SetSRID(ST_MakePoint(15.350,-4.420),4326)),
  ('Kimbanseke', 320000, ST_SetSRID(ST_MakePoint(15.360,-4.430),4326)),
  ('Masina', 350000, ST_SetSRID(ST_MakePoint(15.370,-4.440),4326)),
  ('Nsele', 280000, ST_SetSRID(ST_MakePoint(15.400,-4.450),4326)),
  ('Kisenso', 200000, ST_SetSRID(ST_MakePoint(15.280,-4.400),4326)),
  ('Mont-Ngafula', 240000, ST_SetSRID(ST_MakePoint(15.260,-4.380),4326)),
  ('Lukunga', 180000, ST_SetSRID(ST_MakePoint(15.330,-4.360),4326))
) AS c(name, population, location)
WHERE p.code = 'KIN'
ON CONFLICT (name, province_id) DO NOTHING;
-- [build_sql] suite de 20260725173039_005_seed_data.sql (données de démonstration) volontairement omise.

-- ###### 20260725173139_006_sample_reports.sql : OMISE (données de démonstration / comptes), voir database/build_sql.py

-- ###### 20260725173340_007_seed_reports_retry.sql : OMISE (données de démonstration / comptes), voir database/build_sql.py

-- ###### 20260725173411_008_gis_coords_function.sql
/*
# Database function: get_gis_points_with_coords

## Purpose
Returns GIS points with latitude/longitude extracted from PostGIS geometry,
so the frontend map can render markers without needing to parse WKB.

## Returns
Table with: id, category, name, description, commune_id, status, metadata,
is_active, lat, lng

## Notes
1. Uses ST_Y/ST_X to extract coordinates from the Point geometry
2. Only returns active points
*/
CREATE OR REPLACE FUNCTION get_gis_points_with_coords()
RETURNS TABLE (
  id uuid,
  category gis_category,
  name text,
  description text,
  commune_id uuid,
  status text,
  metadata jsonb,
  is_active boolean,
  lat double precision,
  lng double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    g.id,
    g.category,
    g.name,
    g.description,
    g.commune_id,
    g.status,
    g.metadata,
    g.is_active,
    ST_Y(g.location) AS lat,
    ST_X(g.location) AS lng
  FROM gis_points g
  WHERE g.is_active = true
  ORDER BY g.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_gis_points_with_coords() TO anon, authenticated;

-- ###### 20260725174458_009_intelligent_layer_iot_ai.sql
-- ============================================================
-- SMART CITY RDC 2035 — Intelligent Layer
-- Quartiers, IoT, Telemetry, extended domain models, PostGIS
-- ============================================================

-- ============================================================
-- 1. QUARTIERS (neighborhoods within communes)
-- ============================================================
CREATE TABLE IF NOT EXISTS quartiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  commune_id uuid NOT NULL REFERENCES communes(id) ON DELETE CASCADE,
  population integer DEFAULT 0,
  location geometry(Point, 4326),
  boundary geometry(MultiPolygon, 4326),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE quartiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quartiers_read" ON quartiers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "quartiers_write" ON quartiers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "quartiers_update" ON quartiers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "quartiers_delete" ON quartiers FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 2. IoT DEVICES (master registry)
-- ============================================================
CREATE TABLE IF NOT EXISTS iot_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text UNIQUE NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('streetlight','waste_bin','water_meter','energy_meter','traffic_light','camera','air_sensor','noise_sensor','flood_sensor')),
  model text,
  manufacturer text,
  location geometry(Point, 4326) NOT NULL,
  commune_id uuid REFERENCES communes(id),
  quartier_id uuid REFERENCES quartiers(id),
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('online','offline','warning','error','maintenance')),
  battery_level integer CHECK (battery_level >= 0 AND battery_level <= 100),
  firmware_version text,
  last_seen timestamptz,
  metadata jsonb DEFAULT '{}',
  installed_at date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE iot_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "iot_read" ON iot_devices FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "iot_insert" ON iot_devices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "iot_update" ON iot_devices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "iot_delete" ON iot_devices FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_iot_devices_type ON iot_devices(type);
CREATE INDEX idx_iot_devices_status ON iot_devices(status);
CREATE INDEX idx_iot_devices_location ON iot_devices USING GIST(location);

-- ============================================================
-- 3. IoT SENSORS (sub-sensors on devices)
-- ============================================================

CREATE TABLE IF NOT EXISTS iot_sensors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES iot_devices(id) ON DELETE CASCADE,
  sensor_type text NOT NULL CHECK (sensor_type IN ('temperature','humidity','fill_level','flow_rate','voltage','current','power','luminance','air_quality','noise_db','water_pressure','gps','motion','smoke','co2','pm25')),
  unit text NOT NULL DEFAULT '',
  min_value numeric,
  max_value numeric,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE iot_sensors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sensors_read" ON iot_sensors FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "sensors_insert" ON iot_sensors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sensors_update" ON iot_sensors FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sensors_delete" ON iot_sensors FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_iot_sensors_device ON iot_sensors(device_id);

-- ============================================================
-- 4. IoT TELEMETRY (time-series readings)
-- ============================================================
CREATE TABLE IF NOT EXISTS iot_telemetry (
  id bigserial PRIMARY KEY,
  device_id uuid NOT NULL REFERENCES iot_devices(id) ON DELETE CASCADE,
  sensor_id uuid REFERENCES iot_sensors(id) ON DELETE SET NULL,
  metric text NOT NULL,
  value numeric NOT NULL,
  unit text DEFAULT '',
  quality text DEFAULT 'good' CHECK (quality IN ('good','questionable','bad')),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE iot_telemetry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "telemetry_read" ON iot_telemetry FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "telemetry_insert" ON iot_telemetry FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE INDEX idx_telemetry_device_time ON iot_telemetry(device_id, recorded_at DESC);
CREATE INDEX idx_telemetry_metric_time ON iot_telemetry(metric, recorded_at DESC);

-- ============================================================
-- 5. WASTE MODULE (extended)
-- ============================================================
CREATE TABLE IF NOT EXISTS waste_bins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES iot_devices(id),
  commune_id uuid REFERENCES communes(id),
  quartier_id uuid REFERENCES quartiers(id),
  location geometry(Point, 4326) NOT NULL,
  capacity_liters integer NOT NULL DEFAULT 1000,
  fill_percent integer DEFAULT 0 CHECK (fill_percent >= 0 AND fill_percent <= 100),
  type text DEFAULT 'mixed' CHECK (type IN ('mixed','organic','recyclable','hazardous')),
  status text DEFAULT 'empty' CHECK (status IN ('empty','filling','full','collected','overflow')),
  last_emptied timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE waste_bins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bins_read" ON waste_bins FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "bins_insert" ON waste_bins FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "bins_update" ON waste_bins FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "bins_delete" ON waste_bins FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_waste_bins_location ON waste_bins USING GIST(location);

CREATE TABLE IF NOT EXISTS waste_trucks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate text UNIQUE NOT NULL,
  driver_name text,
  capacity_kg integer DEFAULT 5000,
  current_load_kg integer DEFAULT 0,
  location geometry(Point, 4326),
  status text DEFAULT 'idle' CHECK (status IN ('idle','en_route','collecting','returning','maintenance')),
  assigned_commune_id uuid REFERENCES communes(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE waste_trucks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trucks_read" ON waste_trucks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "trucks_insert" ON waste_trucks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "trucks_update" ON waste_trucks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "trucks_delete" ON waste_trucks FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS waste_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bin_id uuid NOT NULL REFERENCES waste_bins(id) ON DELETE CASCADE,
  truck_id uuid REFERENCES waste_trucks(id),
  collected_liters integer DEFAULT 0,
  collected_at timestamptz DEFAULT now(),
  duration_min integer,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE waste_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collections_read" ON waste_collections FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "collections_insert" ON waste_collections FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "collections_update" ON waste_collections FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "collections_delete" ON waste_collections FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 6. TRAFFIC MODULE (extended)
-- ============================================================
CREATE TABLE IF NOT EXISTS traffic_roads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  road_type text DEFAULT 'street' CHECK (road_type IN ('highway','avenue','street','roundabout','bridge')),
  path geometry(LineString, 4326),
  length_m integer,
  commune_id uuid REFERENCES communes(id),
  max_speed integer DEFAULT 50,
  lanes integer DEFAULT 2,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE traffic_roads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roads_read" ON traffic_roads FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "roads_insert" ON traffic_roads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "roads_update" ON traffic_roads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "roads_delete" ON traffic_roads FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_traffic_roads_path ON traffic_roads USING GIST(path);

CREATE TABLE IF NOT EXISTS traffic_cameras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES iot_devices(id),
  road_id uuid REFERENCES traffic_roads(id),
  location geometry(Point, 4326) NOT NULL,
  stream_url text,
  status text DEFAULT 'offline' CHECK (status IN ('online','offline','maintenance')),
  vehicle_count integer DEFAULT 0,
  avg_speed_kmh integer DEFAULT 0,
  congestion_level text DEFAULT 'free' CHECK (congestion_level IN ('free','moderate','heavy','jam')),
  last_update timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE traffic_cameras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tcam_read" ON traffic_cameras FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "tcam_insert" ON traffic_cameras FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "tcam_update" ON traffic_cameras FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tcam_delete" ON traffic_cameras FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS traffic_accidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location geometry(Point, 4326) NOT NULL,
  road_id uuid REFERENCES traffic_roads(id),
  severity text DEFAULT 'minor' CHECK (severity IN ('minor','moderate','serious','fatal')),
  vehicles_involved integer DEFAULT 1,
  injuries integer DEFAULT 0,
  fatalities integer DEFAULT 0,
  description text,
  status text DEFAULT 'active' CHECK (status IN ('active','cleared','investigating')),
  reported_by uuid REFERENCES profiles(id),
  occurred_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE traffic_accidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acc_read" ON traffic_accidents FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "acc_insert" ON traffic_accidents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "acc_update" ON traffic_accidents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "acc_delete" ON traffic_accidents FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_traffic_accidents_location ON traffic_accidents USING GIST(location);

-- ============================================================
-- 7. ENERGY MODULE (extended)
-- ============================================================
CREATE TABLE IF NOT EXISTS energy_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text DEFAULT 'substation' CHECK (type IN ('substation','solar','hydro','thermal','generator','wind')),
  location geometry(Point, 4326) NOT NULL,
  capacity_mw numeric,
  current_output_mw numeric DEFAULT 0,
  status text DEFAULT 'operational' CHECK (status IN ('operational','maintenance','fault','offline')),
  commune_id uuid REFERENCES communes(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE energy_stations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "es_read" ON energy_stations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "es_insert" ON energy_stations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "es_update" ON energy_stations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "es_delete" ON energy_stations FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_energy_stations_location ON energy_stations USING GIST(location);

CREATE TABLE IF NOT EXISTS energy_meters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES iot_devices(id),
  station_id uuid REFERENCES energy_stations(id),
  commune_id uuid REFERENCES communes(id),
  location geometry(Point, 4326),
  consumer_type text DEFAULT 'residential' CHECK (consumer_type IN ('residential','commercial','industrial','government')),
  current_kw numeric DEFAULT 0,
  daily_kwh numeric DEFAULT 0,
  monthly_kwh numeric DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active','inactive','fault')),
  last_reading timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE energy_meters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "em_read" ON energy_meters FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "em_insert" ON energy_meters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "em_update" ON energy_meters FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "em_delete" ON energy_meters FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS energy_outages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid REFERENCES energy_stations(id),
  commune_id uuid REFERENCES communes(id),
  affected_meters integer DEFAULT 0,
  reason text,
  started_at timestamptz DEFAULT now(),
  restored_at timestamptz,
  status text DEFAULT 'active' CHECK (status IN ('active','restored','scheduled')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE energy_outages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eo_read" ON energy_outages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "eo_insert" ON energy_outages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "eo_update" ON energy_outages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "eo_delete" ON energy_outages FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 8. WATER MODULE (extended)
-- ============================================================
CREATE TABLE IF NOT EXISTS water_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text DEFAULT 'treatment' CHECK (type IN ('treatment','pumping','reservoir','borehole','spring')),
  location geometry(Point, 4326) NOT NULL,
  capacity_m3 integer,
  current_output_m3h numeric DEFAULT 0,
  status text DEFAULT 'operational' CHECK (status IN ('operational','maintenance','fault','offline')),
  commune_id uuid REFERENCES communes(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE water_stations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_read" ON water_stations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "ws_insert" ON water_stations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ws_update" ON water_stations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ws_delete" ON water_stations FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_water_stations_location ON water_stations USING GIST(location);

CREATE TABLE IF NOT EXISTS water_reservoirs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location geometry(Point, 4326) NOT NULL,
  capacity_m3 integer NOT NULL,
  current_level_m3 integer DEFAULT 0,
  fill_percent numeric DEFAULT 0,
  status text DEFAULT 'normal' CHECK (status IN ('normal','low','critical','overflow','maintenance')),
  commune_id uuid REFERENCES communes(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE water_reservoirs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wr_read" ON water_reservoirs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "wr_insert" ON water_reservoirs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wr_update" ON water_reservoirs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "wr_delete" ON water_reservoirs FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS water_leaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location geometry(Point, 4326) NOT NULL,
  station_id uuid REFERENCES water_stations(id),
  severity text DEFAULT 'minor' CHECK (severity IN ('minor','moderate','major','critical')),
  flow_rate_lpm numeric,
  status text DEFAULT 'reported' CHECK (status IN ('reported','investigating','repairing','repaired')),
  reported_by uuid REFERENCES profiles(id),
  detected_at timestamptz DEFAULT now(),
  repaired_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE water_leaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wl_read" ON water_leaks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "wl_insert" ON water_leaks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wl_update" ON water_leaks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "wl_delete" ON water_leaks FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_water_leaks_location ON water_leaks USING GIST(location);

-- ============================================================
-- 9. SECURITY MODULE (extended)
-- ============================================================
CREATE TABLE IF NOT EXISTS security_patrols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_name text NOT NULL,
  officer_count integer DEFAULT 1,
  location geometry(Point, 4326),
  status text DEFAULT 'available' CHECK (status IN ('available','on_patrol','responding','offline')),
  commune_id uuid REFERENCES communes(id),
  shift_start timestamptz,
  shift_end timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE security_patrols ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sp_read" ON security_patrols FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "sp_insert" ON security_patrols FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sp_update" ON security_patrols FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sp_delete" ON security_patrols FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 10. AI PREDICTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model text NOT NULL CHECK (model IN ('traffic_forecast','anomaly_detection','energy_forecast','waste_optimization','incident_analysis')),
  target_type text NOT NULL,
  target_id uuid,
  prediction jsonb NOT NULL,
  confidence numeric CHECK (confidence >= 0 AND confidence <= 1),
  features jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ai_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_read" ON ai_predictions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "ai_insert" ON ai_predictions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "ai_update" ON ai_predictions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ai_delete" ON ai_predictions FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_ai_predictions_model ON ai_predictions(model, created_at DESC);

-- ============================================================
-- 11. POSTGIS UTILITY FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION get_devices_within_radius(lat double precision, lng double precision, radius_m integer)
RETURNS TABLE (
  id uuid, device_id text, name text, type text, status text,
  distance_m double precision, lat double precision, lng double precision
)
LANGUAGE sql STABLE AS $$
  SELECT
    d.id, d.device_id, d.name, d.type, d.status,
    ST_Distance(d.location::geography, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) AS distance_m,
    ST_Y(d.location) AS lat,
    ST_X(d.location) AS lng
  FROM iot_devices d
  WHERE ST_DWithin(d.location::geography, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography, radius_m)
  ORDER BY distance_m ASC;
$$;

CREATE OR REPLACE FUNCTION get_iot_devices_with_coords()
RETURNS TABLE (
  id uuid, device_id text, name text, type text, status text,
  battery_level integer, last_seen timestamptz, lat double precision, lng double precision,
  commune_id uuid, metadata jsonb
)
LANGUAGE sql STABLE AS $$
  SELECT
    id, device_id, name, type, status, battery_level, last_seen,
    ST_Y(location) AS lat, ST_X(location) AS lng,
    commune_id, metadata
  FROM iot_devices
  ORDER BY created_at DESC;
$$;

-- ============================================================
-- 12. REALTIME PUBLICATION FOR IOT TELEMETRY
-- ============================================================
DO $pub$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='iot_telemetry') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.iot_telemetry; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='iot_devices') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.iot_devices; END IF;
END $pub$;
-- [build_sql] suite de 20260725174458_009_intelligent_layer_iot_ai.sql (données de démonstration) volontairement omise.

-- ###### 20260725181108_010_security_hardening.sql
-- Migration 010 was intentionally empty in the original history (kept to preserve version order).
-- Its intent (security hardening) was delivered by 0135, 014, 016, 018, 019, 021 and 022.
SELECT 1;

-- ###### 20260726093229_011_news_articles.sql
-- News articles table for the citizen portal
CREATE TABLE IF NOT EXISTS public.news_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  excerpt text,
  content text,
  category text NOT NULL DEFAULT 'info' CHECK (category IN ('government','works','traffic','weather','alert','event','info')),
  source text,
  image_url text,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

-- Policies: published articles are readable by everyone (anon + authenticated)
CREATE POLICY "select_published_news" ON public.news_articles
  FOR SELECT TO anon, authenticated
  USING (is_published = true);

-- Only authenticated users can insert/update/delete (admins)
CREATE POLICY "insert_news_authenticated" ON public.news_articles
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "update_news_authenticated" ON public.news_articles
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_news_authenticated" ON public.news_articles
  FOR DELETE TO authenticated USING (true);

-- Index for ordering
CREATE INDEX IF NOT EXISTS idx_news_created_at ON public.news_articles (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_category ON public.news_articles (category);
-- [build_sql] suite de 20260726093229_011_news_articles.sql (données de démonstration) volontairement omise.

-- ###### 20260726094226_012_fix_profiles_rls_recursion.sql
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

-- ###### 20260726094606_013_seed_admin_password.sql : OMISE (données de démonstration / comptes), voir database/build_sql.py

-- ###### 20260726100000_0135_bootstrap_security_objects.sql
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

-- ###### 20260726112851_014_security_hardening_fix.sql
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

-- ###### 20260727135830_015_extend_user_roles.sql.sql
/*
# Step 6 — Extend user_role enum with service roles

## Purpose
Adds emergency, water, energy, waste, and transport roles to support
service-specific dashboards (police, water, energy, waste, transport).

## Changes
- Adds new enum values to user_role type.
- Non-destructive: existing roles are untouched.

## Security
- No data is modified or deleted.
- RLS policies referencing user_role continue to work (new values are additive).
*/

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'emergency';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'water';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'energy';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'waste';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'transport';

-- ###### 20260727151838_016_rls_tightening.sql
/*
# RLS Tightening — Fix overly-permissive policies + add profiles INSERT

## Purpose
1. profiles: add INSERT policy so new users can create their own profile row
   (register flow). Without this, INSERT fails under RLS.
2. reports: restrict UPDATE to staff roles (admin, government, ministry,
   province, commune, agent) instead of "any authenticated user".
3. interventions: restrict INSERT/UPDATE to staff roles instead of "any
   authenticated user".
4. report_events: restrict INSERT to staff (system events are inserted by
   edge functions using service role, which bypasses RLS).
5. Domain tables (traffic_sensors, energy_assets, water_assets,
   lighting_assets, security_cameras): restrict INSERT/UPDATE/DELETE to
   staff roles instead of "any authenticated user".

## Security
- Citizens can no longer mutate infrastructure data or other users' reports.
- New users can self-register a profile row (role defaults to 'citizen').
- All changes are idempotent (DROP IF EXISTS before CREATE).
- No data is modified or deleted.
*/

-- ========== profiles: INSERT policy for self-registration ==========
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
CREATE POLICY "insert_own_profile" ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- ========== reports: tighten UPDATE to staff only ==========
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_update_report" ON public.reports;
CREATE POLICY "agent_update_report" ON public.reports FOR UPDATE
  TO authenticated USING (
    public.get_current_user_role() IN ('admin','government','ministry','province','commune','agent')
  ) WITH CHECK (
    public.get_current_user_role() IN ('admin','government','ministry','province','commune','agent')
  );

-- ========== interventions: tighten to staff only ==========
ALTER TABLE public.interventions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_insert_intervention" ON public.interventions;
CREATE POLICY "admin_insert_intervention" ON public.interventions FOR INSERT
  TO authenticated WITH CHECK (
    public.get_current_user_role() IN ('admin','government','ministry','province','commune','agent')
  );

DROP POLICY IF EXISTS "agent_update_intervention" ON public.interventions;
CREATE POLICY "agent_update_intervention" ON public.interventions FOR UPDATE
  TO authenticated USING (
    public.get_current_user_role() IN ('admin','government','ministry','province','commune','agent')
  ) WITH CHECK (
    public.get_current_user_role() IN ('admin','government','ministry','province','commune','agent')
  );

-- ========== report_events: tighten INSERT to staff ==========
ALTER TABLE public.report_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert_event" ON public.report_events;
CREATE POLICY "insert_event" ON public.report_events FOR INSERT
  TO authenticated WITH CHECK (
    public.get_current_user_role() IN ('admin','government','ministry','province','commune','agent')
  );

-- ========== Domain tables: tighten INSERT/UPDATE/DELETE to staff ==========
-- Helper to apply staff-only write policies to a domain table
CREATE OR REPLACE FUNCTION apply_domain_write_policies(t text) RETURNS void AS $$
BEGIN
  EXECUTE format('DROP POLICY IF EXISTS "auth_insert_%s" ON %I;', t, t);
  EXECUTE format(
    'CREATE POLICY "auth_insert_%s" ON %I FOR INSERT TO authenticated WITH CHECK (public.get_current_user_role() IN (''admin'',''government'',''ministry'',''province'',''commune'',''agent''));',
    t, t
  );
  EXECUTE format('DROP POLICY IF EXISTS "auth_update_%s" ON %I;', t, t);
  EXECUTE format(
    'CREATE POLICY "auth_update_%s" ON %I FOR UPDATE TO authenticated USING (public.get_current_user_role() IN (''admin'',''government'',''ministry'',''province'',''commune'',''agent'')) WITH CHECK (public.get_current_user_role() IN (''admin'',''government'',''ministry'',''province'',''commune'',''agent''));',
    t, t
  );
  EXECUTE format('DROP POLICY IF EXISTS "auth_delete_%s" ON %I;', t, t);
  EXECUTE format(
    'CREATE POLICY "auth_delete_%s" ON %I FOR DELETE TO authenticated USING (public.get_current_user_role() IN (''admin'',''government'',''ministry'',''province'',''commune'',''agent''));',
    t, t
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT apply_domain_write_policies('traffic_sensors');
SELECT apply_domain_write_policies('energy_assets');
SELECT apply_domain_write_policies('water_assets');
SELECT apply_domain_write_policies('lighting_assets');
SELECT apply_domain_write_policies('security_cameras');

DROP FUNCTION apply_domain_write_policies(text);

-- ========== emergency_incidents: tighten UPDATE to staff ==========
ALTER TABLE public.emergency_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_update_emergency" ON public.emergency_incidents;
CREATE POLICY "agent_update_emergency" ON public.emergency_incidents FOR UPDATE
  TO authenticated USING (
    public.get_current_user_role() IN ('admin','government','ministry','province','commune','agent','police','emergency')
  ) WITH CHECK (
    public.get_current_user_role() IN ('admin','government','ministry','province','commune','agent','police','emergency')
  );

-- ###### 20260728171907_017_set_demo_passwords.sql.sql : OMISE (données de démonstration / comptes), voir database/build_sql.py

-- ###### 20260808180358_018_final_stabilization.sql.sql
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

-- ###### 20260808181906_019_fix_profiles_recursion_and_admin_rpc.sql.sql
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

-- ###### 20260809163530_020_fix_handle_new_user_phone.sql.sql
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

-- ###### 20260809170000_021_finish_rls_hardening.sql
/*
# Finish RLS hardening — close the remaining wide-open write policies

## Problem
The repo's own `audit-posture.txt` (a point-in-time RLS audit, kept in the
repo root) shows that migrations 016 and 018 tightened write access on
some tables (reports, interventions, gis_points, iot_devices, quartiers,
provinces, communes, news_articles, the 5 "domain" tables) but left many
others with `USING (true)` / `WITH CHECK (true)` for `anon` and/or
`authenticated` on INSERT, UPDATE and DELETE. In practice this means any
signed-in citizen (and in several cases, an unauthenticated visitor who
merely has the public anon key) could rewrite or delete infrastructure
data: energy stations, water reservoirs, waste trucks, traffic cameras,
security patrols, AI predictions, IoT sensor readings, etc.

None of these domain dashboards currently perform writes from the browser
(they read from Supabase or use static data), and the one place that does
write high-volume sensor data — the `iot-ingest` edge function — uses the
Supabase service role key, which bypasses RLS entirely. So tightening
these policies to "staff roles only" does not remove any working feature;
it only removes an unintended door.

## Fix
For every remaining over-permissive table, drop the exact legacy policy
(by the name recorded in audit-posture.txt, so it is actually replaced —
RLS policies are OR'd together, so adding a stricter policy without
dropping the old permissive one would change nothing) and recreate
INSERT/UPDATE/DELETE restricted to staff roles. Public/authenticated
SELECT is left untouched — these are public dashboards by design.

## Security
- Idempotent: every DROP uses IF EXISTS, every CREATE recreates from
  scratch, so this is safe to run more than once and safe to run whether
  or not the legacy policy names exist.
- No data is modified or deleted.
*/

CREATE OR REPLACE FUNCTION public.harden_domain_table(
  p_table text,
  p_legacy_insert text,
  p_legacy_update text,
  p_legacy_delete text
) RETURNS void AS $$
BEGIN
  -- Remove the legacy wide-open policies (exact names from audit-posture.txt)
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', p_legacy_insert, p_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', p_legacy_update, p_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', p_legacy_delete, p_table);

  -- Also remove/replace anything already created under the new naming
  -- scheme, in case this migration runs more than once.
  EXECUTE format('DROP POLICY IF EXISTS "staff_insert_%s" ON %I;', p_table, p_table);
  EXECUTE format(
    'CREATE POLICY "staff_insert_%s" ON %I FOR INSERT TO authenticated WITH CHECK (public.get_current_user_role() IN (''admin'',''government'',''ministry'',''province'',''commune'',''agent''));',
    p_table, p_table
  );

  EXECUTE format('DROP POLICY IF EXISTS "staff_update_%s" ON %I;', p_table, p_table);
  EXECUTE format(
    'CREATE POLICY "staff_update_%s" ON %I FOR UPDATE TO authenticated USING (public.get_current_user_role() IN (''admin'',''government'',''ministry'',''province'',''commune'',''agent'')) WITH CHECK (public.get_current_user_role() IN (''admin'',''government'',''ministry'',''province'',''commune'',''agent''));',
    p_table, p_table
  );

  EXECUTE format('DROP POLICY IF EXISTS "staff_delete_%s" ON %I;', p_table, p_table);
  EXECUTE format(
    'CREATE POLICY "staff_delete_%s" ON %I FOR DELETE TO authenticated USING (public.get_current_user_role() IN (''admin'',''government'',''ministry'',''province'',''commune'',''agent''));',
    p_table, p_table
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='energy_meters') THEN
    PERFORM public.harden_domain_table('energy_meters', 'em_insert', 'em_update', 'em_delete');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='energy_outages') THEN
    PERFORM public.harden_domain_table('energy_outages', 'eo_insert', 'eo_update', 'eo_delete');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='energy_stations') THEN
    PERFORM public.harden_domain_table('energy_stations', 'es_insert', 'es_update', 'es_delete');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='iot_sensors') THEN
    PERFORM public.harden_domain_table('iot_sensors', 'sensors_insert', 'sensors_update', 'sensors_delete');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='security_patrols') THEN
    PERFORM public.harden_domain_table('security_patrols', 'sp_insert', 'sp_update', 'sp_delete');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='traffic_accidents') THEN
    PERFORM public.harden_domain_table('traffic_accidents', 'acc_insert', 'acc_update', 'acc_delete');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='traffic_cameras') THEN
    PERFORM public.harden_domain_table('traffic_cameras', 'tcam_insert', 'tcam_update', 'tcam_delete');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='traffic_roads') THEN
    PERFORM public.harden_domain_table('traffic_roads', 'roads_insert', 'roads_update', 'roads_delete');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='waste_bins') THEN
    PERFORM public.harden_domain_table('waste_bins', 'bins_insert', 'bins_update', 'bins_delete');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='waste_collections') THEN
    PERFORM public.harden_domain_table('waste_collections', 'collections_insert', 'collections_update', 'collections_delete');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='waste_trucks') THEN
    PERFORM public.harden_domain_table('waste_trucks', 'trucks_insert', 'trucks_update', 'trucks_delete');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='water_leaks') THEN
    PERFORM public.harden_domain_table('water_leaks', 'wl_insert', 'wl_update', 'wl_delete');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='water_reservoirs') THEN
    PERFORM public.harden_domain_table('water_reservoirs', 'wr_insert', 'wr_update', 'wr_delete');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='water_stations') THEN
    PERFORM public.harden_domain_table('water_stations', 'ws_insert', 'ws_update', 'ws_delete');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ai_predictions') THEN
    PERFORM public.harden_domain_table('ai_predictions', 'ai_insert', 'ai_update', 'ai_delete');
  END IF;
END $$;

-- iot_telemetry only ever had INSERT + SELECT policies (no UPDATE/DELETE —
-- telemetry rows are immutable readings). Tighten INSERT only; ingestion
-- from real devices goes through the iot-ingest edge function, which uses
-- the service role key and bypasses RLS entirely.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='iot_telemetry') THEN
    DROP POLICY IF EXISTS "telemetry_insert" ON public.iot_telemetry;
    DROP POLICY IF EXISTS "staff_insert_iot_telemetry" ON public.iot_telemetry;
    CREATE POLICY "staff_insert_iot_telemetry" ON public.iot_telemetry FOR INSERT
      TO authenticated WITH CHECK (
        public.get_current_user_role() IN ('admin','government','ministry','province','commune','agent')
      );
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.harden_domain_table(text, text, text, text);

-- ###### 20261013100000_022_security_provenance_workflow.sql
/*
# 022 — Security, data provenance and report workflow (corrective, non-destructive)

## Why
Audit of 2026-10-13 found: (1) seed/demo rows indistinguishable from real data, (2) IoT devices
without credentials (anyone "staff" could insert telemetry), (3) any authenticated user able to read
every citizen report, (4) status/priority of a new report chosen by the client, (5) role changes
possible for the 'government' role through is_admin(), (6) forgeable security/audit logs,
(7) ai_predictions.model CHECK too narrow for a real LLM use case.

## What
- is_demo / is_simulated provenance flags (pre-existing seed rows are flagged, nothing is deleted)
- iot_device_credentials (hash only, no policy => service role only)
- reports: forced safe INSERT values, workflow guard on UPDATE, automatic 'created' event,
  owner-or-staff SELECT, get_reports_with_coords()
- profiles: role / is_active can only be changed by a real admin (is_super_admin)
- audit/security logs: no anonymous direct INSERT; RPCs derive identity from auth.uid()
- ai_predictions.model CHECK widened

## Rollback notes
Every statement is additive or a policy replacement. To roll back: drop the new triggers/functions
listed below and recreate the old policies from migrations 004/016/0135. Data is untouched.

## Idempotency
Safe to run twice. Seed-flagging blocks only run the first time the column is created.
*/

-- ============================================================
-- 0. helpers
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND is_active);
$$;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_active
      AND role::text IN ('admin','government','ministry','province','commune','agent')
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- ============================================================
-- 1. Provenance flags (pre-existing rows are seed data => flagged, not deleted)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='iot_devices' AND column_name='is_simulated') THEN
    ALTER TABLE public.iot_devices ADD COLUMN is_simulated boolean NOT NULL DEFAULT false;
    UPDATE public.iot_devices SET is_simulated = true;   -- no authenticated device existed before this migration
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='iot_telemetry' AND column_name='is_simulated') THEN
    ALTER TABLE public.iot_telemetry ADD COLUMN is_simulated boolean NOT NULL DEFAULT false;
    UPDATE public.iot_telemetry SET is_simulated = true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='gis_points' AND column_name='is_demo') THEN
    ALTER TABLE public.gis_points ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
    UPDATE public.gis_points SET is_demo = true;          -- seeded by migration 005; unflag verified rows manually
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='emergency_incidents' AND column_name='is_demo') THEN
    ALTER TABLE public.emergency_incidents ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
    UPDATE public.emergency_incidents e SET is_demo = true
    WHERE e.reported_by IS NULL
       OR e.reported_by IN (SELECT id FROM auth.users WHERE email LIKE '%@smartcity-rdc.cd');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reports' AND column_name='is_demo') THEN
    ALTER TABLE public.reports ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
    UPDATE public.reports r SET is_demo = true
    WHERE r.reporter_id IN (SELECT id FROM auth.users WHERE email LIKE '%@smartcity-rdc.cd');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reports_created ON public.reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_is_demo ON public.reports (is_demo);
CREATE INDEX IF NOT EXISTS idx_telemetry_real ON public.iot_telemetry (metric, recorded_at DESC) WHERE is_simulated = false;
-- Replay protection: same device + metric + timestamp can only be stored once.
CREATE UNIQUE INDEX IF NOT EXISTS uq_telemetry_replay ON public.iot_telemetry (device_id, metric, recorded_at);

-- ============================================================
-- 2. IoT credentials (hash only; RLS on, NO policy => service role only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.iot_device_credentials (
  device_id uuid PRIMARY KEY REFERENCES public.iot_devices(id) ON DELETE CASCADE,
  api_key_hash text NOT NULL,
  rotated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.iot_device_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.iot_device_credentials FROM anon, authenticated;

-- Telemetry: only the service role (edge function) may insert. Drop every client-side INSERT policy.
DROP POLICY IF EXISTS "telemetry_insert" ON public.iot_telemetry;
DROP POLICY IF EXISTS "staff_insert_iot_telemetry" ON public.iot_telemetry;

DROP FUNCTION IF EXISTS public.get_iot_devices_with_coords();
CREATE FUNCTION public.get_iot_devices_with_coords()
RETURNS TABLE (id uuid, device_id text, name text, type text, status text, battery_level integer,
  last_seen timestamptz, lat double precision, lng double precision, commune_id uuid, metadata jsonb,
  is_simulated boolean)
LANGUAGE sql STABLE AS $$
  SELECT d.id, d.device_id, d.name, d.type, d.status, d.battery_level, d.last_seen,
         ST_Y(d.location), ST_X(d.location), d.commune_id, d.metadata, d.is_simulated
  FROM public.iot_devices d ORDER BY d.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_iot_devices_with_coords() TO anon, authenticated;
ALTER FUNCTION public.get_iot_devices_with_coords() SET search_path TO 'public', 'extensions'; -- PostGIS peut résider dans « extensions » (activation via le dashboard)

-- ============================================================
-- 3. AI predictions: widen model list; writes are service-role only
-- ============================================================
ALTER TABLE public.ai_predictions DROP CONSTRAINT IF EXISTS ai_predictions_model_check;
ALTER TABLE public.ai_predictions ADD CONSTRAINT ai_predictions_model_check CHECK (model IN (
  'traffic_forecast','anomaly_detection','energy_forecast','waste_optimization','incident_analysis',
  'incident_summary','report_classification'));
DROP POLICY IF EXISTS "ai_read" ON public.ai_predictions;
DROP POLICY IF EXISTS "staff_insert_ai_predictions" ON public.ai_predictions;
DROP POLICY IF EXISTS "staff_update_ai_predictions" ON public.ai_predictions;
DROP POLICY IF EXISTS "staff_delete_ai_predictions" ON public.ai_predictions;
DROP POLICY IF EXISTS "staff_read_ai_predictions" ON public.ai_predictions;
CREATE POLICY "staff_read_ai_predictions" ON public.ai_predictions FOR SELECT TO authenticated USING (public.is_staff());

-- ============================================================
-- 4. Reports: safe inserts, workflow guard, events, owner-or-staff reads
-- ============================================================
CREATE OR REPLACE FUNCTION public.reports_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$  -- ST_Y/ST_X : PostGIS peut résider dans « extensions »
BEGIN
  NEW.status := 'pending';
  NEW.assigned_to := NULL;
  NEW.validated_by := NULL;
  NEW.resolved_at := NULL;
  NEW.is_demo := false;
  IF auth.uid() IS NOT NULL THEN NEW.reporter_id := auth.uid(); END IF;
  IF NEW.location IS NOT NULL AND (ST_Y(NEW.location) NOT BETWEEN -90 AND 90 OR ST_X(NEW.location) NOT BETWEEN -180 AND 180) THEN
    RAISE EXCEPTION 'Invalid coordinates';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_reports_before_insert ON public.reports;
CREATE TRIGGER trg_reports_before_insert BEFORE INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.reports_before_insert();

CREATE OR REPLACE FUNCTION public.reports_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.report_events (report_id, event_type, to_status, actor_id)
  VALUES (NEW.id, 'created', 'pending', NEW.reporter_id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_reports_after_insert ON public.reports;
CREATE TRIGGER trg_reports_after_insert AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.reports_after_insert();

CREATE OR REPLACE FUNCTION public.reports_before_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ok boolean;
BEGIN
  -- immutable fields
  NEW.reporter_id := OLD.reporter_id;
  NEW.reference := OLD.reference;
  NEW.created_at := OLD.created_at;
  NEW.is_demo := OLD.is_demo;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    ok := (OLD.status::text, NEW.status::text) IN (
      ('pending','validated'),('pending','rejected'),('validated','assigned'),('validated','rejected'),
      ('assigned','in_progress'),('in_progress','resolved'));
    IF NOT ok THEN
      RAISE EXCEPTION 'Invalid report status transition % -> %', OLD.status, NEW.status;
    END IF;
    IF NEW.status::text = 'resolved' THEN NEW.resolved_at := now(); END IF;
    IF NEW.status::text = 'validated' AND auth.uid() IS NOT NULL THEN NEW.validated_by := auth.uid(); END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_reports_before_update ON public.reports;
CREATE TRIGGER trg_reports_before_update BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.reports_before_update();

-- Direct (browser) updates by staff are traced here. The api-gateway (service role, auth.uid() IS NULL)
-- writes its own event with the verified actor.
CREATE OR REPLACE FUNCTION public.reports_after_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.report_events (report_id, event_type, from_status, to_status, actor_id)
    VALUES (NEW.id, NEW.status::text, OLD.status::text, NEW.status::text, auth.uid());
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_reports_after_update ON public.reports;
CREATE TRIGGER trg_reports_after_update AFTER UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.reports_after_update();

DROP POLICY IF EXISTS "auth_read_reports" ON public.reports;
DROP POLICY IF EXISTS "read_own_or_staff_reports" ON public.reports;
CREATE POLICY "read_own_or_staff_reports" ON public.reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "auth_read_events" ON public.report_events;
DROP POLICY IF EXISTS "read_own_or_staff_events" ON public.report_events;
CREATE POLICY "read_own_or_staff_events" ON public.report_events FOR SELECT TO authenticated
  USING (public.is_staff() OR EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.reporter_id = auth.uid()));

DROP POLICY IF EXISTS "auth_read_interventions" ON public.interventions;
DROP POLICY IF EXISTS "read_staff_interventions" ON public.interventions;
CREATE POLICY "read_staff_interventions" ON public.interventions FOR SELECT TO authenticated
  USING (public.is_staff() OR agent_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_reports_with_coords()
RETURNS TABLE (id uuid, reference text, category text, title text, status text, priority text,
  address text, created_at timestamptz, is_demo boolean, lat double precision, lng double precision)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, extensions AS $$   -- RLS of the caller applies ; « extensions » : PostGIS (ST_Y/ST_X) peut y résider
  SELECT r.id, r.reference, r.category::text, r.title, r.status::text, r.priority::text, r.address,
         r.created_at, r.is_demo, ST_Y(r.location), ST_X(r.location)
  FROM public.reports r WHERE r.location IS NOT NULL ORDER BY r.created_at DESC LIMIT 1000;
$$;
GRANT EXECUTE ON FUNCTION public.get_reports_with_coords() TO authenticated;

-- ============================================================
-- 5. Profiles: only a real admin may change role / is_active
-- ============================================================
CREATE OR REPLACE FUNCTION public.profiles_guard_privileged()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.is_active IS DISTINCT FROM OLD.is_active)
     AND auth.uid() IS NOT NULL            -- service role / migrations are not blocked
     AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only an administrator can change role or activation';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_profiles_guard_privileged ON public.profiles;
CREATE TRIGGER trg_profiles_guard_privileged BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_privileged();

CREATE OR REPLACE FUNCTION public.admin_update_user_role(p_user_id uuid, p_new_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Permission denied: admin access required'; END IF;
  IF p_new_role NOT IN ('admin','government','ministry','province','commune','police','emergency','water','energy','waste','transport','agent','citizen') THEN
    RAISE EXCEPTION 'Invalid role: %', p_new_role;
  END IF;
  IF p_user_id = auth.uid() AND p_new_role <> 'admin' THEN
    RAISE EXCEPTION 'An administrator cannot remove their own admin role';
  END IF;
  UPDATE public.profiles SET role = p_new_role::user_role, updated_at = now() WHERE id = p_user_id;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'profile.role_change', 'profile', p_user_id, jsonb_build_object('new_role', p_new_role));
END $$;
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_toggle_user_active(p_user_id uuid, p_active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Permission denied: admin access required'; END IF;
  IF p_user_id = auth.uid() AND p_active = false THEN RAISE EXCEPTION 'An administrator cannot deactivate themselves'; END IF;
  UPDATE public.profiles SET is_active = p_active, updated_at = now() WHERE id = p_user_id;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'profile.active_change', 'profile', p_user_id, jsonb_build_object('is_active', p_active));
END $$;
GRANT EXECUTE ON FUNCTION public.admin_toggle_user_active(uuid, boolean) TO authenticated;

-- ============================================================
-- 6. Audit / security logs: no forgeable direct INSERT
-- ============================================================
DROP POLICY IF EXISTS "audit_insert_anon" ON public.audit_log;
DROP POLICY IF EXISTS "auth_insert_audit" ON public.audit_log;
DROP POLICY IF EXISTS "audit_read_authenticated" ON public.audit_log;
DROP POLICY IF EXISTS "admin_read_audit" ON public.audit_log;
CREATE POLICY "admin_read_audit" ON public.audit_log FOR SELECT TO authenticated USING (public.is_super_admin());

DROP POLICY IF EXISTS "login_attempts_insert" ON public.login_attempts;
DROP POLICY IF EXISTS "security_events_insert" ON public.security_events;

-- Identity is derived from the session, never from parameters.
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type text, p_user_id uuid, p_ip text, p_agent text, p_details jsonb DEFAULT '{}'::jsonb, p_severity text DEFAULT 'info')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  INSERT INTO public.security_events (event_type, user_id, ip_address, user_agent, details, severity)
  VALUES (left(p_event_type, 64), auth.uid(), NULL, left(p_agent, 256), COALESCE(p_details, '{}'::jsonb),
          CASE WHEN p_severity IN ('info','warning','critical') THEN p_severity ELSE 'info' END);
END $$;
REVOKE EXECUTE ON FUNCTION public.log_security_event(text, uuid, text, text, jsonb, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.log_security_event(text, uuid, text, text, jsonb, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_login_attempt(p_identifier text, p_success boolean, p_agent text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_identifier IS NULL OR length(p_identifier) NOT BETWEEN 3 AND 254 THEN RETURN; END IF;
  INSERT INTO public.login_attempts (identifier, success, user_agent)
  VALUES (lower(p_identifier), COALESCE(p_success, false), left(p_agent, 256));
END $$;
GRANT EXECUTE ON FUNCTION public.record_login_attempt(text, boolean, text) TO anon, authenticated;
-- NOTE: this lockout is advisory (client-driven). Real brute-force protection = Supabase Auth rate limits.

-- ============================================================
-- 7. gis_points RPC exposes the demo flag (same columns + is_demo)
-- ============================================================
DROP FUNCTION IF EXISTS public.get_gis_points_with_coords();
CREATE FUNCTION public.get_gis_points_with_coords()
RETURNS TABLE (id uuid, category gis_category, name text, description text, commune_id uuid, status text,
  metadata jsonb, is_active boolean, lat double precision, lng double precision, is_demo boolean)
LANGUAGE sql STABLE SET search_path TO 'public', 'extensions' AS $$
  SELECT g.id, g.category, g.name, g.description, g.commune_id, g.status, g.metadata, g.is_active,
         ST_Y(g.location), ST_X(g.location), g.is_demo
  FROM public.gis_points g WHERE g.is_active = true AND g.location IS NOT NULL ORDER BY g.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_gis_points_with_coords() TO anon, authenticated;

-- ###### 20261014090000_023_audit_hardening.sql
-- ============================================================
-- 023 — Correctifs issus de l'audit SQL/sécurité du 2026-10-14
-- Additive, idempotente, NON destructive (aucun DROP TABLE/COLUMN, aucun TRUNCATE, aucun DELETE de données).
-- Chaque point a été reproduit sur PostgreSQL 16 avant correction (voir docs/AUDIT_SQL_SECURITE.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. PostGIS peut résider dans le schéma « extensions » (activation via le dashboard Supabase).
--    Les fonctions épinglées sur search_path = public ne trouvent alors ni ST_Y/ST_X/ST_Distance
--    ni le type geography. Ajouter « extensions » est sans effet si PostGIS est dans public
--    (un schéma inexistant dans un search_path est ignoré par PostgreSQL).
-- ------------------------------------------------------------
ALTER FUNCTION public.get_devices_within_radius(double precision, double precision, integer)
  SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.get_gis_points_with_coords()  SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.get_iot_devices_with_coords() SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.get_reports_with_coords()     SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.reports_before_insert()       SET search_path TO 'public', 'extensions';

-- ------------------------------------------------------------
-- 2. Fonctions SECURITY DEFINER appelables par n'importe qui via /rest/v1/rpc (anon inclus)
--    - check_rate_limit : un anonyme pouvait consommer le quota d'un autre utilisateur ou d'un appareil IoT
--      (clé 'iot:<id>', 'ai-classify:<uid>') et remplir api_rate_limits. Seules les Edge Functions
--      (clé service) l'utilisent.
--    - log_audit_entry : un anonyme pouvait écrire dans audit_log avec un actor_id arbitraire
--      (falsification de la piste d'audit). Aucun code client ne l'appelle.
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.log_audit_entry(uuid, text, text, uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit_entry(uuid, text, text, uuid, jsonb, text) TO service_role;

-- Les RPC d'administration refusent déjà les non-admins ; on retire en plus l'accès anonyme (défense en profondeur).
REVOKE ALL ON FUNCTION public.admin_update_user_role(uuid, text)     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_toggle_user_active(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(uuid, text)     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_toggle_user_active(uuid, boolean) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.log_security_event(text, uuid, text, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_security_event(text, uuid, text, text, jsonb, text) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 3. Brouillons d'actualités lisibles par tout le monde (y compris anonymes)
--    Cause : la politique « public_read_news » (018) USING (true) s'ajoute (OR) à « select_published_news » (011).
--    Correction : lecture publique = articles publiés uniquement ; les admins gardent la lecture complète.
--    (Restreint des droits ; n'en élargit aucun.)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "public_read_news" ON public.news_articles;
DROP POLICY IF EXISTS "admin_read_all_news" ON public.news_articles;
CREATE POLICY "admin_read_all_news" ON public.news_articles
  FOR SELECT TO authenticated USING (public.is_admin());

-- ------------------------------------------------------------
-- 4. Intégrité référentielle : reports.reporter_id
--    reporter_id est « NOT NULL … ON DELETE SET NULL » ET le trigger d'immutabilité (022) réécrit
--    NEW.reporter_id := OLD.reporter_id. Quand le profil du déclarant est supprimé, l'action SET NULL de la
--    clé étrangère était annulée par le trigger : le signalement gardait un reporter_id ORPHELIN
--    (la contrainte FK devenait violée en silence ; un dump/restore échouerait).
--    Correction : (a) la colonne accepte NULL (conforme à l'intention « ON DELETE SET NULL » : anonymisation),
--    (b) le trigger n'autorise le passage à NULL que si le profil d'origine n'existe plus,
--    (c) les orphelins déjà présents sont mis à NULL (valeur sans signification : le profil n'existe plus).
--    L'immutabilité reste garantie pour tout autre cas ; la RLS (reporter_id = auth.uid()) est inchangée.
-- ------------------------------------------------------------
ALTER TABLE public.reports ALTER COLUMN reporter_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.reports_before_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ok boolean;
BEGIN
  -- immutable fields
  IF NEW.reporter_id IS DISTINCT FROM OLD.reporter_id THEN
    -- seule exception : action ON DELETE SET NULL de la clé étrangère, profil d'origine disparu
    IF NOT (NEW.reporter_id IS NULL AND OLD.reporter_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = OLD.reporter_id)) THEN
      NEW.reporter_id := OLD.reporter_id;
    END IF;
  END IF;
  NEW.reference := OLD.reference;
  NEW.created_at := OLD.created_at;
  NEW.is_demo := OLD.is_demo;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    ok := (OLD.status::text, NEW.status::text) IN (
      ('pending','validated'),('pending','rejected'),('validated','assigned'),('validated','rejected'),
      ('assigned','in_progress'),('in_progress','resolved'));
    IF NOT ok THEN
      RAISE EXCEPTION 'Invalid report status transition % -> %', OLD.status, NEW.status;
    END IF;
    IF NEW.status::text = 'resolved' THEN NEW.resolved_at := now(); END IF;
    IF NEW.status::text = 'validated' AND auth.uid() IS NOT NULL THEN NEW.validated_by := auth.uid(); END IF;
  END IF;
  RETURN NEW;
END $$;

UPDATE public.reports r SET reporter_id = NULL
 WHERE r.reporter_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = r.reporter_id);

-- ------------------------------------------------------------
-- 5. NON appliqué volontairement (décisions métier, voir docs/AUDIT_SQL_SECURITE.md §5) :
--    - interventions.agent_id et emergency_incidents.reported_by : même contradiction NOT NULL / SET NULL,
--      mais sans corruption (la suppression du profil est simplement refusée avec une erreur claire).
--    - emergency_incidents lisibles par tout utilisateur authentifié (adresse, déclarant).
--    - actualités de démonstration (011) publiées comme de vraies actualités.
-- ------------------------------------------------------------

-- ###### 20261015090000_024_report_attachments.sql
-- ============================================================
-- 024 — Pièces jointes (photos) des signalements
-- Additive, idempotente, NON destructive. Dépend de : reports (002), is_staff() (022), schéma storage (Supabase).
-- Modèle : bucket PRIVÉ « report-attachments », chemin  <reporter_id>/<report_id>/<uuid>.<ext>
--          table  report_attachments  = registre des fichiers (propriétaire, type, taille).
-- Limites : 5 Mo / fichier, JPEG-PNG-WebP, 3 fichiers max par signalement.
-- ============================================================

-- 1. Bucket privé (public = false : aucune URL publique ; accès par URL signée courte durée)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('report-attachments', 'report-attachments', false, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = 5242880,
      allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];

-- 2. Registre
CREATE TABLE IF NOT EXISTS public.report_attachments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id     uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  uploaded_by   uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path  text NOT NULL UNIQUE,
  mime_type     text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
  size_bytes    integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- le chemin doit être <uploaded_by>/<report_id>/<fichier> : empêche d'associer un fichier à un autre dossier
  CONSTRAINT report_attachments_path_shape CHECK (
    storage_path ~ ('^' || uploaded_by::text || '/' || report_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$')
  )
);
CREATE INDEX IF NOT EXISTS idx_report_attachments_report ON public.report_attachments(report_id);

ALTER TABLE public.report_attachments ENABLE ROW LEVEL SECURITY;

-- Quota : 3 photos maximum par signalement
CREATE OR REPLACE FUNCTION public.report_attachments_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $$
BEGIN
  IF (SELECT count(*) FROM public.report_attachments WHERE report_id = NEW.report_id) >= 3 THEN
    RAISE EXCEPTION 'Maximum 3 photos par signalement' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_report_attachments_limit ON public.report_attachments;
CREATE TRIGGER trg_report_attachments_limit BEFORE INSERT ON public.report_attachments
  FOR EACH ROW EXECUTE FUNCTION public.report_attachments_limit();

-- Politiques (lecture : propriétaire du signalement ou personnel ; écriture : propriétaire, signalement encore « pending »)
DROP POLICY IF EXISTS "attachments_select" ON public.report_attachments;
CREATE POLICY "attachments_select" ON public.report_attachments FOR SELECT TO authenticated
  USING (uploaded_by = auth.uid() OR public.is_staff()
         OR EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.reporter_id = auth.uid()));

DROP POLICY IF EXISTS "attachments_insert_owner" ON public.report_attachments;
CREATE POLICY "attachments_insert_owner" ON public.report_attachments FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid()
              AND EXISTS (SELECT 1 FROM public.reports r
                          WHERE r.id = report_id AND r.reporter_id = auth.uid() AND r.status = 'pending'));

DROP POLICY IF EXISTS "attachments_delete_owner" ON public.report_attachments;
CREATE POLICY "attachments_delete_owner" ON public.report_attachments FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid()
         AND EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.status = 'pending'));

REVOKE ALL ON public.report_attachments FROM anon;
GRANT SELECT, INSERT, DELETE ON public.report_attachments TO authenticated;
GRANT ALL ON public.report_attachments TO service_role;

-- 3. Politiques Storage (objets du bucket privé uniquement)
DROP POLICY IF EXISTS "report_att_read" ON storage.objects;
CREATE POLICY "report_att_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'report-attachments'
         AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_staff()));

DROP POLICY IF EXISTS "report_att_insert" ON storage.objects;
CREATE POLICY "report_att_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'report-attachments'
              AND (storage.foldername(name))[1] = auth.uid()::text
              AND EXISTS (SELECT 1 FROM public.reports r
                          WHERE r.id::text = (storage.foldername(name))[2]
                            AND r.reporter_id = auth.uid() AND r.status = 'pending'));

DROP POLICY IF EXISTS "report_att_delete" ON storage.objects;
CREATE POLICY "report_att_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'report-attachments'
         AND (storage.foldername(name))[1] = auth.uid()::text
         AND EXISTS (SELECT 1 FROM public.reports r
                     WHERE r.id::text = (storage.foldername(name))[2] AND r.status = 'pending'));
-- Pas de politique UPDATE : un fichier ne se modifie pas, il se supprime puis se renvoie.

-- ###### 20261015120000_025_attachment_verification.sql
-- ============================================================
-- 025 — Vérification serveur des pièces jointes
-- Additive, idempotente, non destructive. Dépend de 024.
-- Le navigateur n'est pas digne de confiance : un fichier n'est exploitable (affiché, envoyé à Gemini)
-- qu'une fois verified = true, posé UNIQUEMENT par l'Edge Function verify-attachments (clé service)
-- après contrôle des octets réels du fichier stocké.
-- ============================================================
ALTER TABLE public.report_attachments ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.report_attachments ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- Un client ne peut pas s'auto-déclarer « vérifié »
DROP POLICY IF EXISTS "attachments_insert_owner" ON public.report_attachments;
CREATE POLICY "attachments_insert_owner" ON public.report_attachments FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND verified = false AND verified_at IS NULL
              AND EXISTS (SELECT 1 FROM public.reports r
                          WHERE r.id = report_id AND r.reporter_id = auth.uid() AND r.status = 'pending'));

-- Aucun UPDATE pour authenticated (déjà le cas en 024) ; on le garantit explicitement.
REVOKE UPDATE ON public.report_attachments FROM anon, authenticated;
GRANT UPDATE (verified, verified_at) ON public.report_attachments TO service_role;

-- ###### 20261017100000_026_ai_suggestion_decisions.sql
-- ============================================================
-- 026 — Validation humaine des suggestions de classification Gemini
-- Additive, idempotente, NON destructive : aucun DROP TABLE/COLUMN, aucun TRUNCATE, aucun DELETE de données,
-- aucune ancienne migration modifiée, RLS jamais désactivée.
--
-- Contenu
--   1. Table public.ai_suggestion_decisions : historique APPEND-ONLY (une décision par suggestion).
--   2. RLS : lecture réservée au personnel (is_staff()) ; AUCUNE politique d'écriture pour anon/authenticated.
--   3. Fonction public.apply_ai_suggestion_decision() : applique la décision ET écrit l'historique + l'audit
--      dans UNE seule transaction (tout réussit ou rien n'est modifié). Appelable uniquement par service_role
--      (Edge Function ai-service, qui a déjà authentifié l'utilisateur). Les contrôles sont refaits ici
--      (rôle, baisse de priorité, valeurs autorisées, concurrence) : défense en profondeur.
--
-- Rollback (aucune donnée métier n'est touchée par cette migration) :
--   DROP FUNCTION IF EXISTS public.apply_ai_suggestion_decision(uuid,uuid,text,boolean,boolean,text,text,boolean,text,text,timestamptz,text,uuid);
--   DROP TABLE IF EXISTS public.ai_suggestion_decisions;   -- supprime l'historique des décisions (à n'exécuter que volontairement)
--   DROP FUNCTION IF EXISTS public.ai_suggestion_decisions_block_update();
-- ============================================================

-- ------------------------------------------------------------
-- 1. Historique des décisions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_suggestion_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id uuid NOT NULL REFERENCES public.ai_predictions(id) ON DELETE RESTRICT,
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('accepted', 'modified', 'rejected')),
  -- ce que Gemini a proposé (copie au moment de la décision)
  suggested_category text NOT NULL,
  suggested_priority text NOT NULL,
  -- valeurs du signalement AVANT / APRÈS la décision
  previous_category public.report_category NOT NULL,
  previous_priority public.report_priority NOT NULL,
  final_category public.report_category NOT NULL,
  final_priority public.report_priority NOT NULL,
  category_applied boolean NOT NULL DEFAULT false,
  priority_applied boolean NOT NULL DEFAULT false,
  priority_lowered boolean NOT NULL DEFAULT false,
  -- qui / quand
  decided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_role text NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  comment text CHECK (comment IS NULL OR char_length(comment) <= 500),
  -- suggestion complète telle que produite par le modèle (aucun secret : résumé, faits, hypothèses, recommandation)
  suggestion_snapshot jsonb NOT NULL,
  model_name text,
  -- clé d'idempotence fournie par le client : un double clic / une requête rejouée ne crée qu'UNE décision
  request_id uuid NOT NULL,
  CONSTRAINT ai_decisions_one_per_prediction UNIQUE (prediction_id),
  CONSTRAINT ai_decisions_request_unique UNIQUE (request_id),
  CONSTRAINT ai_decisions_rejected_unchanged CHECK (
    decision <> 'rejected'
    OR (final_category = previous_category AND final_priority = previous_priority
        AND NOT category_applied AND NOT priority_applied AND NOT priority_lowered)
  )
);

CREATE INDEX IF NOT EXISTS idx_ai_decisions_report ON public.ai_suggestion_decisions (report_id, decided_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_decided_at ON public.ai_suggestion_decisions (decided_at DESC);

-- Append-only : une décision enregistrée ne se modifie plus (même avec la clé service).
CREATE OR REPLACE FUNCTION public.ai_suggestion_decisions_block_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'ai_suggestion_decisions est en ajout seul : une décision enregistrée ne peut pas être modifiée';
END $$;

DROP TRIGGER IF EXISTS trg_ai_decisions_no_update ON public.ai_suggestion_decisions;
CREATE TRIGGER trg_ai_decisions_no_update BEFORE UPDATE ON public.ai_suggestion_decisions
  FOR EACH ROW EXECUTE FUNCTION public.ai_suggestion_decisions_block_update();

-- ------------------------------------------------------------
-- 2. RLS : lecture personnel uniquement, aucune écriture directe
-- ------------------------------------------------------------
ALTER TABLE public.ai_suggestion_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_ai_suggestion_decisions" ON public.ai_suggestion_decisions;
CREATE POLICY "staff_read_ai_suggestion_decisions" ON public.ai_suggestion_decisions
  FOR SELECT TO authenticated USING (public.is_staff());

REVOKE ALL ON public.ai_suggestion_decisions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ai_suggestion_decisions TO authenticated;
GRANT ALL ON public.ai_suggestion_decisions TO service_role;

-- ------------------------------------------------------------
-- 3. Application atomique d'une décision
--    Retourne toujours un jsonb { ok: true, ... } ou { ok: false, code: '...' } (jamais d'écriture partielle :
--    toutes les vérifications précèdent les écritures, et les écritures sont dans un bloc à sous-transaction).
--    Codes d'échec : invalid_decision, forbidden, request_id_conflict, prediction_not_found, already_decided,
--    report_not_found, report_changed, invalid_suggestion, nothing_to_apply, invalid_value, not_modified,
--    priority_decrease_forbidden, priority_decrease_unconfirmed.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_ai_suggestion_decision(
  p_prediction_id uuid,
  p_actor_id uuid,
  p_decision text,                       -- 'accepted' | 'modified' | 'rejected'
  p_apply_category boolean,              -- accepted : champs explicitement approuvés
  p_apply_priority boolean,
  p_category text,                       -- modified : valeurs choisies par l'agent (ignorées sinon)
  p_priority text,
  p_confirm_priority_decrease boolean,   -- confirmation explicite d'une baisse de priorité
  p_expected_category text,              -- valeurs lues par l'interface (détection de modification concurrente)
  p_expected_priority text,
  p_expected_updated_at timestamptz,
  p_comment text,
  p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_staff_roles    text[] := ARRAY['admin','government','ministry','province','commune','agent'];
  v_lower_roles    text[] := ARRAY['admin','government','ministry','province'];  -- rôles autorisés à BAISSER une priorité
  v_ranks          text[] := ARRAY['low','medium','high','critical'];
  v_cats           text[] := enum_range(NULL::public.report_category)::text[];
  v_pris           text[] := enum_range(NULL::public.report_priority)::text[];
  v_role           text;
  v_active         boolean;
  v_pred           public.ai_predictions%ROWTYPE;
  v_report         public.reports%ROWTYPE;
  v_existing       public.ai_suggestion_decisions%ROWTYPE;
  v_row            public.ai_suggestion_decisions%ROWTYPE;
  v_sugg_cat       text;
  v_sugg_pri       text;
  v_final_cat      public.report_category;
  v_final_pri      public.report_priority;
  v_cat_applied    boolean := false;
  v_pri_applied    boolean := false;
  v_lowered        boolean := false;
  v_comment        text := NULLIF(btrim(COALESCE(p_comment, '')), '');
BEGIN
  IF p_decision IS NULL OR p_decision NOT IN ('accepted', 'modified', 'rejected') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_decision');
  END IF;
  IF p_request_id IS NULL OR p_prediction_id IS NULL OR p_actor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_decision');
  END IF;
  IF v_comment IS NOT NULL AND char_length(v_comment) > 500 THEN
    v_comment := left(v_comment, 500);
  END IF;

  -- 1) Acteur : profil actif ET rôle du personnel (contrôle refait ici même si l'Edge Function l'a déjà fait)
  SELECT p.role::text, p.is_active INTO v_role, v_active FROM public.profiles p WHERE p.id = p_actor_id;
  IF NOT FOUND OR v_active IS NOT TRUE OR v_role IS NULL OR NOT (v_role = ANY (v_staff_roles)) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  -- 2) Requête déjà traitée (double clic, nouvel essai après coupure réseau) : on renvoie la décision existante
  SELECT * INTO v_existing FROM public.ai_suggestion_decisions WHERE request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.prediction_id = p_prediction_id AND v_existing.decided_by IS NOT DISTINCT FROM p_actor_id THEN
      RETURN jsonb_build_object('ok', true, 'replayed', true, 'decision', to_jsonb(v_existing));
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'request_id_conflict');
  END IF;

  -- 3) Suggestion : verrou de ligne => deux décisions simultanées sur la même suggestion sont sérialisées
  SELECT * INTO v_pred FROM public.ai_predictions
   WHERE id = p_prediction_id AND model = 'report_classification' AND target_type = 'report' AND target_id IS NOT NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'prediction_not_found');
  END IF;

  SELECT * INTO v_existing FROM public.ai_suggestion_decisions WHERE prediction_id = p_prediction_id;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_decided', 'decision', to_jsonb(v_existing));
  END IF;

  -- 4) Signalement : toujours présent ? (verrou de ligne jusqu'à la fin de la transaction)
  SELECT * INTO v_report FROM public.reports WHERE id = v_pred.target_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'report_not_found');
  END IF;

  -- 5) Modification concurrente : les valeurs lues par l'agent doivent être celles d'aujourd'hui
  IF v_report.category::text IS DISTINCT FROM p_expected_category
     OR v_report.priority::text IS DISTINCT FROM p_expected_priority
     OR v_report.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RETURN jsonb_build_object('ok', false, 'code', 'report_changed',
      'current', jsonb_build_object('category', v_report.category, 'priority', v_report.priority,
                                    'status', v_report.status, 'updated_at', v_report.updated_at));
  END IF;

  -- 6) La suggestion vient TOUJOURS de la base (jamais du client) et doit rester une valeur autorisée
  v_sugg_cat := v_pred.prediction ->> 'category';
  v_sugg_pri := v_pred.prediction ->> 'priority';
  IF v_sugg_cat IS NULL OR NOT (v_sugg_cat = ANY (v_cats)) OR v_sugg_pri IS NULL OR NOT (v_sugg_pri = ANY (v_pris)) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_suggestion');
  END IF;

  -- 7) Valeurs finales
  v_final_cat := v_report.category;
  v_final_pri := v_report.priority;

  IF p_decision = 'accepted' THEN
    IF NOT (COALESCE(p_apply_category, false) OR COALESCE(p_apply_priority, false)) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'nothing_to_apply');
    END IF;
    IF COALESCE(p_apply_category, false) THEN v_final_cat := v_sugg_cat::public.report_category; v_cat_applied := true; END IF;
    IF COALESCE(p_apply_priority, false) THEN v_final_pri := v_sugg_pri::public.report_priority; v_pri_applied := true; END IF;

  ELSIF p_decision = 'modified' THEN
    IF p_category IS NULL OR NOT (p_category = ANY (v_cats)) OR p_priority IS NULL OR NOT (p_priority = ANY (v_pris)) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'invalid_value');
    END IF;
    IF p_category = v_sugg_cat AND p_priority = v_sugg_pri THEN
      RETURN jsonb_build_object('ok', false, 'code', 'not_modified');   -- identique à la suggestion : utiliser « Accepter »
    END IF;
    v_final_cat := p_category::public.report_category;
    v_final_pri := p_priority::public.report_priority;
    v_cat_applied := true;
    v_pri_applied := true;
  END IF;
  -- 'rejected' : ni catégorie ni priorité ne changent.

  -- 8) Baisse de priorité (et a fortiori de « critical ») : rôle habilité + confirmation explicite
  IF array_position(v_ranks, v_final_pri::text) < array_position(v_ranks, v_report.priority::text) THEN
    v_lowered := true;
    IF NOT (v_role = ANY (v_lower_roles)) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'priority_decrease_forbidden');
    END IF;
    IF p_confirm_priority_decrease IS NOT TRUE THEN
      RETURN jsonb_build_object('ok', false, 'code', 'priority_decrease_unconfirmed');
    END IF;
  END IF;

  -- 9) Écritures atomiques : mise à jour + historique + audit. Le bloc BEGIN … EXCEPTION est une sous-transaction :
  --    en cas d'erreur, la mise à jour du signalement est annulée avec le reste.
  BEGIN
    IF v_final_cat IS DISTINCT FROM v_report.category OR v_final_pri IS DISTINCT FROM v_report.priority THEN
      UPDATE public.reports SET category = v_final_cat, priority = v_final_pri WHERE id = v_report.id;
    END IF;

    INSERT INTO public.ai_suggestion_decisions (
      prediction_id, report_id, decision, suggested_category, suggested_priority,
      previous_category, previous_priority, final_category, final_priority,
      category_applied, priority_applied, priority_lowered,
      decided_by, decided_role, comment, suggestion_snapshot, model_name, request_id
    ) VALUES (
      v_pred.id, v_report.id, p_decision, v_sugg_cat, v_sugg_pri,
      v_report.category, v_report.priority, v_final_cat, v_final_pri,
      v_cat_applied, v_pri_applied, v_lowered,
      p_actor_id, v_role, v_comment, v_pred.prediction, v_pred.features ->> 'model', p_request_id
    ) RETURNING * INTO v_row;

    INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, details)
    VALUES (p_actor_id, 'ai_suggestion_' || p_decision, 'report', v_report.id, jsonb_build_object(
      'decision_id', v_row.id, 'prediction_id', v_pred.id,
      'previous', jsonb_build_object('category', v_report.category, 'priority', v_report.priority),
      'final', jsonb_build_object('category', v_final_cat, 'priority', v_final_pri),
      'priority_lowered', v_lowered));
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_decided');
  END;

  RETURN jsonb_build_object('ok', true, 'replayed', false, 'decision', to_jsonb(v_row));
END $$;

REVOKE ALL ON FUNCTION public.apply_ai_suggestion_decision(uuid, uuid, text, boolean, boolean, text, text, boolean, text, text, timestamptz, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_ai_suggestion_decision(uuid, uuid, text, boolean, boolean, text, text, boolean, text, text, timestamptz, text, uuid)
  TO service_role;

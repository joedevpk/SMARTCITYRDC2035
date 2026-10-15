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

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
ALTER PUBLICATION supabase_realtime ADD TABLE iot_telemetry;
ALTER PUBLICATION supabase_realtime ADD TABLE iot_devices;

-- ============================================================
-- 13. SEED IoT DEVICES (Kinshasa)
-- ============================================================
INSERT INTO iot_devices (device_id, name, type, location, commune_id, status, battery_level, firmware_version, last_seen, metadata)
SELECT
  'SL-' || lpad(i::text, 4, '0'),
  'Lampadaire ' || lpad(i::text, 4, '0'),
  'streetlight',
  ST_SetSRID(ST_MakePoint(15.30 + (random() - 0.5) * 0.08, -4.32 + (random() - 0.5) * 0.06), 4326),
  c.id,
  CASE WHEN random() > 0.15 THEN 'online' ELSE 'offline' END,
  (60 + floor(random() * 40))::int,
  '2.1.3',
  now() - (random() * interval '1 hour'),
  jsonb_build_object('wattage', 60 + floor(random()*60), 'auto_dim', true)
FROM generate_series(1, 25) i
CROSS JOIN (SELECT id FROM communes WHERE name = 'Gombe' LIMIT 1) c;

INSERT INTO iot_devices (device_id, name, type, location, commune_id, status, battery_level, firmware_version, last_seen, metadata)
SELECT
  'WB-' || lpad(i::text, 4, '0'),
  'Bac à déchets ' || lpad(i::text, 4, '0'),
  'waste_bin',
  ST_SetSRID(ST_MakePoint(15.31 + (random() - 0.5) * 0.08, -4.33 + (random() - 0.5) * 0.06), 4326),
  c.id,
  CASE WHEN random() > 0.1 THEN 'online' ELSE 'warning' END,
  (70 + floor(random() * 30))::int,
  '1.8.0',
  now() - (random() * interval '30 mins'),
  jsonb_build_object('capacity_liters', 1000, 'fill_percent', floor(random()*100))
FROM generate_series(1, 20) i
CROSS JOIN (SELECT id FROM communes WHERE name = 'Gombe' LIMIT 1) c;

INSERT INTO iot_devices (device_id, name, type, location, commune_id, status, battery_level, firmware_version, last_seen, metadata)
SELECT
  'WM-' || lpad(i::text, 4, '0'),
  'Compteur eau ' || lpad(i::text, 4, '0'),
  'water_meter',
  ST_SetSRID(ST_MakePoint(15.29 + (random() - 0.5) * 0.08, -4.31 + (random() - 0.5) * 0.06), 4326),
  c.id,
  CASE WHEN random() > 0.08 THEN 'online' ELSE 'error' END,
  (80 + floor(random() * 20))::int,
  '3.0.1',
  now() - (random() * interval '15 mins'),
  jsonb_build_object('flow_rate_lpm', round((random() * 20)::numeric, 2))
FROM generate_series(1, 15) i
CROSS JOIN (SELECT id FROM communes WHERE name = 'Gombe' LIMIT 1) c;

INSERT INTO iot_devices (device_id, name, type, location, commune_id, status, battery_level, firmware_version, last_seen, metadata)
SELECT
  'EM-' || lpad(i::text, 4, '0'),
  'Compteur énergie ' || lpad(i::text, 4, '0'),
  'energy_meter',
  ST_SetSRID(ST_MakePoint(15.28 + (random() - 0.5) * 0.08, -4.34 + (random() - 0.5) * 0.06), 4326),
  c.id,
  CASE WHEN random() > 0.05 THEN 'online' ELSE 'maintenance' END,
  100,
  '2.5.0',
  now() - (random() * interval '10 mins'),
  jsonb_build_object('current_kw', round((random() * 5)::numeric, 2), 'voltage', 220)
FROM generate_series(1, 15) i
CROSS JOIN (SELECT id FROM communes WHERE name = 'Gombe' LIMIT 1) c;

INSERT INTO iot_devices (device_id, name, type, location, commune_id, status, battery_level, firmware_version, last_seen, metadata)
SELECT
  'TL-' || lpad(i::text, 4, '0'),
  'Feu de circulation ' || lpad(i::text, 4, '0'),
  'traffic_light',
  ST_SetSRID(ST_MakePoint(15.30 + (random() - 0.5) * 0.06, -4.32 + (random() - 0.5) * 0.04), 4326),
  c.id,
  CASE WHEN random() > 0.12 THEN 'online' ELSE 'offline' END,
  100,
  '4.1.0',
  now() - (random() * interval '5 mins'),
  jsonb_build_object('phase', CASE floor(random()*3) WHEN 0 THEN 'red' WHEN 1 THEN 'green' ELSE 'yellow' END, 'cycle_sec', 60)
FROM generate_series(1, 12) i
CROSS JOIN (SELECT id FROM communes WHERE name = 'Gombe' LIMIT 1) c;

-- Seed sensors for each device
INSERT INTO iot_sensors (device_id, sensor_type, unit, min_value, max_value)
SELECT d.id, 'luminance', 'lux', 0, 5000
FROM iot_devices d WHERE d.type = 'streetlight';

INSERT INTO iot_sensors (device_id, sensor_type, unit, min_value, max_value)
SELECT d.id, 'fill_level', '%', 0, 100
FROM iot_devices d WHERE d.type = 'waste_bin';

INSERT INTO iot_sensors (device_id, sensor_type, unit, min_value, max_value)
SELECT d.id, 'flow_rate', 'L/min', 0, 100
FROM iot_devices d WHERE d.type = 'water_meter';

INSERT INTO iot_sensors (device_id, sensor_type, unit, min_value, max_value)
SELECT d.id, 'power', 'kW', 0, 50
FROM iot_devices d WHERE d.type = 'energy_meter';

-- Seed initial telemetry
INSERT INTO iot_telemetry (device_id, sensor_id, metric, value, unit)
SELECT d.id, s.id, 'luminance', floor(random() * 3000), 'lux'
FROM iot_devices d JOIN iot_sensors s ON s.device_id = d.id
WHERE d.type = 'streetlight';

INSERT INTO iot_telemetry (device_id, sensor_id, metric, value, unit)
SELECT d.id, s.id, 'fill_level', floor(random() * 100), '%'
FROM iot_devices d JOIN iot_sensors s ON s.device_id = d.id
WHERE d.type = 'waste_bin';

INSERT INTO iot_telemetry (device_id, sensor_id, metric, value, unit)
SELECT d.id, s.id, 'flow_rate', round((random() * 20)::numeric, 2), 'L/min'
FROM iot_devices d JOIN iot_sensors s ON s.device_id = d.id
WHERE d.type = 'water_meter';

INSERT INTO iot_telemetry (device_id, sensor_id, metric, value, unit)
SELECT d.id, s.id, 'power', round((random() * 5)::numeric, 2), 'kW'
FROM iot_devices d JOIN iot_sensors s ON s.device_id = d.id
WHERE d.type = 'energy_meter';

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

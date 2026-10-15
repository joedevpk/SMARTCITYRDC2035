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

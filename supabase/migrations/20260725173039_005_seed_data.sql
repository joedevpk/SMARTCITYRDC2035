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

-- GIS Points for the interactive map (cast enums explicitly)
INSERT INTO gis_points (category, name, description, location, commune_id, status, metadata)
SELECT 'traffic'::gis_category, name, description, location, commune_id, status, metadata FROM (VALUES
  ('Carrefour Échangeur', 'Trafic dense - circulation ralentie', ST_SetSRID(ST_MakePoint(15.305,-4.325),4326), 'Dense', '{"speed_kmh": 15, "vehicles": 120}'::jsonb),
  ('Bd du 30 Juin', 'Fluidité normale', ST_SetSRID(ST_MakePoint(15.298,-4.328),4326), 'Fluide', '{"speed_kmh": 50, "vehicles": 40}'::jsonb)
) AS t(name, description, location, status, metadata),
LATERAL (SELECT id AS commune_id FROM communes WHERE name = 'Gombe' LIMIT 1) c
ON CONFLICT DO NOTHING;

INSERT INTO gis_points (category, name, description, location, commune_id, status, metadata)
SELECT 'waste'::gis_category, name, description, location, commune_id, status, metadata FROM (VALUES
  ('Point de collecte Gombe', 'Collecte prévue à 14h', ST_SetSRID(ST_MakePoint(15.302,-4.324),4326), 'Planifié', '{"next_collection": "14:00"}'::jsonb)
) AS t(name, description, location, status, metadata),
LATERAL (SELECT id AS commune_id FROM communes WHERE name = 'Gombe' LIMIT 1) c
ON CONFLICT DO NOTHING;

INSERT INTO gis_points (category, name, description, location, commune_id, status, metadata)
SELECT 'waste'::gis_category, name, description, location, commune_id, status, metadata FROM (VALUES
  ('Dépôt Lemba', 'Zone à nettoyer', ST_SetSRID(ST_MakePoint(15.295,-4.382),4326), 'À traiter', '{"volume_m3": 45}'::jsonb)
) AS t(name, description, location, status, metadata),
LATERAL (SELECT id AS commune_id FROM communes WHERE name = 'Lemba' LIMIT 1) c
ON CONFLICT DO NOTHING;

INSERT INTO gis_points (category, name, description, location, commune_id, status, metadata)
SELECT 'light'::gis_category, name, description, location, commune_id, status, metadata FROM (VALUES
  ('Lampadaire #A-142', 'Fonctionne normalement', ST_SetSRID(ST_MakePoint(15.304,-4.326),4326), 'OK', '{"is_on": true}'::jsonb),
  ('Lampadaire #A-148', 'En panne - signalement en cours', ST_SetSRID(ST_MakePoint(15.301,-4.330),4326), 'En panne', '{"is_on": false}'::jsonb)
) AS t(name, description, location, status, metadata),
LATERAL (SELECT id AS commune_id FROM communes WHERE name = 'Gombe' LIMIT 1) c
ON CONFLICT DO NOTHING;

INSERT INTO gis_points (category, name, description, location, commune_id, status, metadata)
SELECT 'camera'::gis_category, name, description, location, commune_id, status, metadata FROM (VALUES
  ('Caméra Centre-ville', 'Surveillance active', ST_SetSRID(ST_MakePoint(15.308,-4.322),4326), 'Active', '{"resolution": "1080p"}'::jsonb),
  ('Caméra Rond-point', 'Hors service', ST_SetSRID(ST_MakePoint(15.297,-4.334),4326), 'HS', '{"resolution": "720p"}'::jsonb)
) AS t(name, description, location, status, metadata),
LATERAL (SELECT id AS commune_id FROM communes WHERE name = 'Gombe' LIMIT 1) c
ON CONFLICT DO NOTHING;

INSERT INTO gis_points (category, name, description, location, commune_id, status, metadata)
SELECT 'hospital'::gis_category, name, description, location, commune_id, status, metadata FROM (VALUES
  ('Hôpital Général de Kinshasa', 'Services d''urgence 24/7', ST_SetSRID(ST_MakePoint(15.300,-4.332),4326), 'Ouvert', '{"beds": 500, "emergency": true}'::jsonb)
) AS t(name, description, location, status, metadata),
LATERAL (SELECT id AS commune_id FROM communes WHERE name = 'Gombe' LIMIT 1) c
ON CONFLICT DO NOTHING;

INSERT INTO gis_points (category, name, description, location, commune_id, status, metadata)
SELECT 'hospital'::gis_category, name, description, location, commune_id, status, metadata FROM (VALUES
  ('Clinique Ngaliema', 'Soins spécialisés', ST_SetSRID(ST_MakePoint(15.285,-4.340),4326), 'Ouvert', '{"beds": 200, "emergency": true}'::jsonb)
) AS t(name, description, location, status, metadata),
LATERAL (SELECT id AS commune_id FROM communes WHERE name = 'Ngaliema' LIMIT 1) c
ON CONFLICT DO NOTHING;

INSERT INTO gis_points (category, name, description, location, commune_id, status, metadata)
SELECT 'police'::gis_category, name, description, location, commune_id, status, metadata FROM (VALUES
  ('Commissariat Gombe', 'Poste de police central', ST_SetSRID(ST_MakePoint(15.306,-4.321),4326), 'Actif', '{"officers": 24}'::jsonb)
) AS t(name, description, location, status, metadata),
LATERAL (SELECT id AS commune_id FROM communes WHERE name = 'Gombe' LIMIT 1) c
ON CONFLICT DO NOTHING;

INSERT INTO gis_points (category, name, description, location, commune_id, status, metadata)
SELECT 'water'::gis_category, name, description, location, commune_id, status, metadata FROM (VALUES
  ('Station de pompage', 'Distribution normale', ST_SetSRID(ST_MakePoint(15.290,-4.345),4326), 'Normal', '{"flow_m3h": 1200}'::jsonb)
) AS t(name, description, location, status, metadata),
LATERAL (SELECT id AS commune_id FROM communes WHERE name = 'Ngaliema' LIMIT 1) c
ON CONFLICT DO NOTHING;

INSERT INTO gis_points (category, name, description, location, commune_id, status, metadata)
SELECT 'water'::gis_category, name, description, location, commune_id, status, metadata FROM (VALUES
  ('Réservoir Lemba', 'Maintenance en cours', ST_SetSRID(ST_MakePoint(15.300,-4.380),4326), 'Maintenance', '{"flow_m3h": 0}'::jsonb)
) AS t(name, description, location, status, metadata),
LATERAL (SELECT id AS commune_id FROM communes WHERE name = 'Lemba' LIMIT 1) c
ON CONFLICT DO NOTHING;

INSERT INTO gis_points (category, name, description, location, commune_id, status, metadata)
SELECT 'power'::gis_category, name, description, location, commune_id, status, metadata FROM (VALUES
  ('Sous-station Gombe', 'Distribution stable', ST_SetSRID(ST_MakePoint(15.303,-4.327),4326), 'Stable', '{"load_kw": 4500, "capacity_kw": 8000}'::jsonb)
) AS t(name, description, location, status, metadata),
LATERAL (SELECT id AS commune_id FROM communes WHERE name = 'Gombe' LIMIT 1) c
ON CONFLICT DO NOTHING;

INSERT INTO gis_points (category, name, description, location, commune_id, status, metadata)
SELECT 'power'::gis_category, name, description, location, commune_id, status, metadata FROM (VALUES
  ('Centrale Lemba', 'Coupure signalée', ST_SetSRID(ST_MakePoint(15.298,-4.375),4326), 'Coupure', '{"load_kw": 0, "capacity_kw": 5000}'::jsonb)
) AS t(name, description, location, status, metadata),
LATERAL (SELECT id AS commune_id FROM communes WHERE name = 'Lemba' LIMIT 1) c
ON CONFLICT DO NOTHING;

INSERT INTO gis_points (category, name, description, location, commune_id, status, metadata)
SELECT 'incident'::gis_category, name, description, location, commune_id, status, metadata FROM (VALUES
  ('Nid-de-poule signalé', 'Route endommagée', ST_SetSRID(ST_MakePoint(15.299,-4.333),4326), 'En cours', '{"severity": "high"}'::jsonb),
  ('Fuite d''eau signalée', 'Intervention en cours', ST_SetSRID(ST_MakePoint(15.292,-4.336),4326), 'En cours', '{"severity": "medium"}'::jsonb),
  ('Tagging murs', 'Nettoyage planifié', ST_SetSRID(ST_MakePoint(15.309,-4.319),4326), 'Planifié', '{"severity": "low"}'::jsonb)
) AS t(name, description, location, status, metadata),
LATERAL (SELECT id AS commune_id FROM communes WHERE name = 'Gombe' LIMIT 1) c
ON CONFLICT DO NOTHING;

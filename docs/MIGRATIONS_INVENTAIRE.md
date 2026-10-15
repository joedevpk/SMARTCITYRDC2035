# Inventaire du schéma SQL (migrations 001 → 023)

> **Fichier généré** par `database/tests/gen_inventory.py` à partir du schéma obtenu en rejouant réellement toutes les migrations sur PostgreSQL 16 + PostGIS 3.4 (voir `database/tests/verify_sql.sh`). Il décrit l'état **attendu** ; l'état de VOTRE base distante se vérifie avec `database/DIAGNOSTIC_LECTURE_SEULE.sql`.

## Extensions requises

- `pgcrypto` 1.3 (utilisée par : crypt(), gen_salt(), gen_random_bytes())
- `postgis` 3.4.2 (utilisée par : types geometry/geography, ST_*)
- `plpgsql` (incluse)

## Tables (39)

| Table | RLS | Politiques | Clé primaire | Clés étrangères |
|---|---|---|---|---|
| `ai_predictions` | oui | 1 | id | — |
| `api_keys` | oui | 0 | id | created_by → profiles (SET NULL) |
| `api_rate_limits` | oui | 0 | id | — |
| `audit_log` | oui | 1 | id | actor_id → profiles (SET NULL) |
| `communes` | oui | 4 | id | province_id → provinces (CASCADE) |
| `emergency_incidents` | oui | 3 | id | commune_id → communes (SET NULL)<br>dispatched_to → profiles (SET NULL)<br>reported_by → profiles (SET NULL) |
| `energy_assets` | oui | 4 | id | commune_id → communes (SET NULL) |
| `energy_meters` | oui | 4 | id | commune_id → communes<br>device_id → iot_devices<br>station_id → energy_stations |
| `energy_outages` | oui | 4 | id | commune_id → communes<br>station_id → energy_stations |
| `energy_stations` | oui | 4 | id | commune_id → communes |
| `gis_points` | oui | 4 | id | commune_id → communes (SET NULL) |
| `interventions` | oui | 5 | id | agent_id → profiles (SET NULL)<br>report_id → reports (CASCADE) |
| `iot_device_credentials` | oui | 0 | device_id | device_id → iot_devices (CASCADE) |
| `iot_devices` | oui | 4 | id | commune_id → communes<br>quartier_id → quartiers |
| `iot_sensors` | oui | 4 | id | device_id → iot_devices (CASCADE) |
| `iot_telemetry` | oui | 1 | id | device_id → iot_devices (CASCADE)<br>sensor_id → iot_sensors (SET NULL) |
| `lighting_assets` | oui | 4 | id | commune_id → communes (SET NULL) |
| `login_attempts` | oui | 2 | id | — |
| `news_articles` | oui | 5 | id | — |
| `notifications` | oui | 8 | id | user_id → profiles (CASCADE) |
| `profiles` | oui | 7 | id | commune_id → communes (SET NULL)<br>id → auth.users (CASCADE)<br>province_id → provinces (SET NULL) |
| `provinces` | oui | 4 | id | — |
| `quartiers` | oui | 4 | id | commune_id → communes (CASCADE) |
| `report_events` | oui | 2 | id | actor_id → profiles (SET NULL)<br>report_id → reports (CASCADE) |
| `reports` | oui | 5 | id | assigned_to → profiles (SET NULL)<br>commune_id → communes (SET NULL)<br>province_id → provinces (SET NULL)<br>reporter_id → profiles (SET NULL)<br>validated_by → profiles (SET NULL) |
| `security_cameras` | oui | 4 | id | commune_id → communes (SET NULL) |
| `security_events` | oui | 1 | id | user_id → profiles (SET NULL) |
| `security_patrols` | oui | 4 | id | commune_id → communes |
| `traffic_accidents` | oui | 4 | id | reported_by → profiles<br>road_id → traffic_roads |
| `traffic_cameras` | oui | 4 | id | device_id → iot_devices<br>road_id → traffic_roads |
| `traffic_roads` | oui | 4 | id | commune_id → communes |
| `traffic_sensors` | oui | 4 | id | commune_id → communes (SET NULL) |
| `waste_bins` | oui | 4 | id | commune_id → communes<br>device_id → iot_devices<br>quartier_id → quartiers |
| `waste_collections` | oui | 4 | id | bin_id → waste_bins (CASCADE)<br>truck_id → waste_trucks |
| `waste_trucks` | oui | 4 | id | assigned_commune_id → communes |
| `water_assets` | oui | 4 | id | commune_id → communes (SET NULL) |
| `water_leaks` | oui | 4 | id | reported_by → profiles<br>station_id → water_stations |
| `water_reservoirs` | oui | 4 | id | commune_id → communes |
| `water_stations` | oui | 4 | id | commune_id → communes |

## Colonnes, types, valeurs par défaut

### `ai_predictions`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `model` | text | non |  |
| `target_type` | text | non |  |
| `target_id` | uuid | oui |  |
| `prediction` | jsonb | non |  |
| `confidence` | numeric | oui |  |
| `features` | jsonb | oui |  |
| `created_at` | timestamp with time zone | oui | `now()` |

Contraintes CHECK / UNIQUE : `ai_predictions_confidence_check` CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric))) ; `ai_predictions_model_check` CHECK ((model = ANY (ARRAY['traffic_forecast'::text, 'anomaly_detection'::text, 'energy_forecast'::text, 'waste_optimization'::text, 'incident_analysis'::text, 'incident_summary'::text, 'report_classification'::text])))

### `api_keys`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `name` | text | non |  |
| `key_hash` | text | non |  |
| `created_by` | uuid | oui |  |
| `revoked` | boolean | non | `false` |
| `created_at` | timestamp with time zone | non | `now()` |

### `api_rate_limits`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | bigint | non | `nextval('api_rate_limits_id_seq'::regclass)` |
| `key` | text | non |  |
| `request_count` | integer | non | `1` |
| `window_start` | timestamp with time zone | non | `now()` |

### `audit_log`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `actor_id` | uuid | oui |  |
| `action` | text | non |  |
| `entity_type` | text | oui |  |
| `entity_id` | uuid | oui |  |
| `details` | jsonb | oui | `'{}'::jsonb` |
| `ip_address` | text | oui |  |
| `created_at` | timestamp with time zone | oui | `now()` |

### `communes`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `name` | text | non |  |
| `province_id` | uuid | non |  |
| `population` | integer | oui | `0` |
| `location` | geometry | oui |  |
| `created_at` | timestamp with time zone | oui | `now()` |

Contraintes CHECK / UNIQUE : `communes_name_province_id_key` UNIQUE (name, province_id)

### `emergency_incidents`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `type` | emergency_type | non |  |
| `severity` | severity_level | oui | `'medium'::severity_level` |
| `location` | geometry | oui |  |
| `address` | text | oui |  |
| `commune_id` | uuid | oui |  |
| `description` | text | non |  |
| `status` | emergency_status | oui | `'active'::emergency_status` |
| `reported_by` | uuid | non | `auth.uid()` |
| `dispatched_to` | uuid | oui |  |
| `resolved_at` | timestamp with time zone | oui |  |
| `created_at` | timestamp with time zone | oui | `now()` |
| `updated_at` | timestamp with time zone | oui | `now()` |
| `is_demo` | boolean | non | `false` |

### `energy_assets`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `name` | text | non |  |
| `type` | energy_asset_type | non |  |
| `location` | geometry | oui |  |
| `commune_id` | uuid | oui |  |
| `capacity_kw` | numeric | oui | `0` |
| `current_load_kw` | numeric | oui | `0` |
| `status` | operational_status | oui | `'operational'::operational_status` |
| `is_active` | boolean | oui | `true` |
| `last_reading_at` | timestamp with time zone | oui |  |
| `created_at` | timestamp with time zone | oui | `now()` |

### `energy_meters`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `device_id` | uuid | oui |  |
| `station_id` | uuid | oui |  |
| `commune_id` | uuid | oui |  |
| `location` | geometry | oui |  |
| `consumer_type` | text | oui | `'residential'::text` |
| `current_kw` | numeric | oui | `0` |
| `daily_kwh` | numeric | oui | `0` |
| `monthly_kwh` | numeric | oui | `0` |
| `status` | text | oui | `'active'::text` |
| `last_reading` | timestamp with time zone | oui |  |
| `created_at` | timestamp with time zone | oui | `now()` |

Contraintes CHECK / UNIQUE : `energy_meters_consumer_type_check` CHECK ((consumer_type = ANY (ARRAY['residential'::text, 'commercial'::text, 'industrial'::text, 'government'::text]))) ; `energy_meters_status_check` CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'fault'::text])))

### `energy_outages`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `station_id` | uuid | oui |  |
| `commune_id` | uuid | oui |  |
| `affected_meters` | integer | oui | `0` |
| `reason` | text | oui |  |
| `started_at` | timestamp with time zone | oui | `now()` |
| `restored_at` | timestamp with time zone | oui |  |
| `status` | text | oui | `'active'::text` |
| `created_at` | timestamp with time zone | oui | `now()` |

Contraintes CHECK / UNIQUE : `energy_outages_status_check` CHECK ((status = ANY (ARRAY['active'::text, 'restored'::text, 'scheduled'::text])))

### `energy_stations`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `name` | text | non |  |
| `type` | text | oui | `'substation'::text` |
| `location` | geometry | non |  |
| `capacity_mw` | numeric | oui |  |
| `current_output_mw` | numeric | oui | `0` |
| `status` | text | oui | `'operational'::text` |
| `commune_id` | uuid | oui |  |
| `created_at` | timestamp with time zone | oui | `now()` |

Contraintes CHECK / UNIQUE : `energy_stations_status_check` CHECK ((status = ANY (ARRAY['operational'::text, 'maintenance'::text, 'fault'::text, 'offline'::text]))) ; `energy_stations_type_check` CHECK ((type = ANY (ARRAY['substation'::text, 'solar'::text, 'hydro'::text, 'thermal'::text, 'generator'::text, 'wind'::text])))

### `gis_points`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `category` | gis_category | non |  |
| `name` | text | non |  |
| `description` | text | oui |  |
| `location` | geometry | oui |  |
| `commune_id` | uuid | oui |  |
| `status` | text | oui |  |
| `metadata` | jsonb | oui | `'{}'::jsonb` |
| `is_active` | boolean | oui | `true` |
| `created_at` | timestamp with time zone | oui | `now()` |
| `updated_at` | timestamp with time zone | oui | `now()` |
| `is_demo` | boolean | non | `false` |

### `interventions`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `report_id` | uuid | non |  |
| `agent_id` | uuid | non |  |
| `status` | intervention_status | non | `'assigned'::intervention_status` |
| `assigned_at` | timestamp with time zone | oui | `now()` |
| `accepted_at` | timestamp with time zone | oui |  |
| `started_at` | timestamp with time zone | oui |  |
| `completed_at` | timestamp with time zone | oui |  |
| `proof_photo_url` | text | oui |  |
| `notes` | text | oui |  |
| `created_at` | timestamp with time zone | oui | `now()` |
| `updated_at` | timestamp with time zone | oui | `now()` |

### `iot_device_credentials`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `device_id` | uuid | non |  |
| `api_key_hash` | text | non |  |
| `rotated_at` | timestamp with time zone | non | `now()` |

### `iot_devices`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `device_id` | text | non |  |
| `name` | text | non |  |
| `type` | text | non |  |
| `model` | text | oui |  |
| `manufacturer` | text | oui |  |
| `location` | geometry | non |  |
| `commune_id` | uuid | oui |  |
| `quartier_id` | uuid | oui |  |
| `status` | text | non | `'offline'::text` |
| `battery_level` | integer | oui |  |
| `firmware_version` | text | oui |  |
| `last_seen` | timestamp with time zone | oui |  |
| `metadata` | jsonb | oui | `'{}'::jsonb` |
| `installed_at` | date | oui | `CURRENT_DATE` |
| `created_at` | timestamp with time zone | oui | `now()` |
| `is_simulated` | boolean | non | `false` |

Contraintes CHECK / UNIQUE : `iot_devices_battery_level_check` CHECK (((battery_level >= 0) AND (battery_level <= 100))) ; `iot_devices_device_id_key` UNIQUE (device_id) ; `iot_devices_status_check` CHECK ((status = ANY (ARRAY['online'::text, 'offline'::text, 'warning'::text, 'error'::text, 'maintenance'::text]))) ; `iot_devices_type_check` CHECK ((type = ANY (ARRAY['streetlight'::text, 'waste_bin'::text, 'water_meter'::text, 'energy_meter'::text, 'traffic_light'::text, 'camera'::text, 'air_sensor'::text, 'noise_sensor'::text, 'flood_sensor'::text])))

### `iot_sensors`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `device_id` | uuid | non |  |
| `sensor_type` | text | non |  |
| `unit` | text | non | `''::text` |
| `min_value` | numeric | oui |  |
| `max_value` | numeric | oui |  |
| `is_active` | boolean | oui | `true` |
| `created_at` | timestamp with time zone | oui | `now()` |

Contraintes CHECK / UNIQUE : `iot_sensors_sensor_type_check` CHECK ((sensor_type = ANY (ARRAY['temperature'::text, 'humidity'::text, 'fill_level'::text, 'flow_rate'::text, 'voltage'::text, 'current'::text, 'power'::text, 'luminance'::text, 'air_quality'::text, 'noise_db'::text, 'water_pressure'::text, 'gps'::text, 'motion'::text, 'smoke'::text, 'co2'::text, 'pm25'::text])))

### `iot_telemetry`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | bigint | non | `nextval('iot_telemetry_id_seq'::regclass)` |
| `device_id` | uuid | non |  |
| `sensor_id` | uuid | oui |  |
| `metric` | text | non |  |
| `value` | numeric | non |  |
| `unit` | text | oui | `''::text` |
| `quality` | text | oui | `'good'::text` |
| `recorded_at` | timestamp with time zone | non | `now()` |
| `is_simulated` | boolean | non | `false` |

Contraintes CHECK / UNIQUE : `iot_telemetry_quality_check` CHECK ((quality = ANY (ARRAY['good'::text, 'questionable'::text, 'bad'::text])))

### `lighting_assets`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `name` | text | non |  |
| `location` | geometry | oui |  |
| `commune_id` | uuid | oui |  |
| `is_on` | boolean | oui | `false` |
| `is_active` | boolean | oui | `true` |
| `bulb_type` | bulb_type | oui | `'led'::bulb_type` |
| `wattage` | integer | oui | `60` |
| `last_maintenance_at` | timestamp with time zone | oui |  |
| `created_at` | timestamp with time zone | oui | `now()` |

### `login_attempts`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | bigint | non | `nextval('login_attempts_id_seq'::regclass)` |
| `identifier` | text | non |  |
| `success` | boolean | non | `false` |
| `user_agent` | text | oui |  |
| `created_at` | timestamp with time zone | non | `now()` |

### `news_articles`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `title` | text | non |  |
| `excerpt` | text | oui |  |
| `content` | text | oui |  |
| `category` | text | non | `'info'::text` |
| `source` | text | oui |  |
| `image_url` | text | oui |  |
| `is_published` | boolean | non | `true` |
| `created_at` | timestamp with time zone | non | `now()` |
| `updated_at` | timestamp with time zone | non | `now()` |

Contraintes CHECK / UNIQUE : `news_articles_category_check` CHECK ((category = ANY (ARRAY['government'::text, 'works'::text, 'traffic'::text, 'weather'::text, 'alert'::text, 'event'::text, 'info'::text])))

### `notifications`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `user_id` | uuid | non |  |
| `title` | text | non |  |
| `message` | text | non |  |
| `type` | notification_type | non | `'info'::notification_type` |
| `category` | text | oui |  |
| `read` | boolean | non | `false` |
| `created_at` | timestamp with time zone | oui | `now()` |

### `profiles`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non |  |
| `full_name` | text | non |  |
| `phone` | text | oui |  |
| `role` | user_role | non | `'citizen'::user_role` |
| `province_id` | uuid | oui |  |
| `commune_id` | uuid | oui |  |
| `avatar_url` | text | oui |  |
| `is_active` | boolean | non | `true` |
| `created_at` | timestamp with time zone | oui | `now()` |
| `updated_at` | timestamp with time zone | oui | `now()` |

### `provinces`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `name` | text | non |  |
| `code` | text | non |  |
| `capital` | text | oui |  |
| `population` | integer | oui | `0` |
| `location` | geometry | oui |  |
| `created_at` | timestamp with time zone | oui | `now()` |

Contraintes CHECK / UNIQUE : `provinces_code_key` UNIQUE (code) ; `provinces_name_key` UNIQUE (name)

### `quartiers`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `name` | text | non |  |
| `commune_id` | uuid | non |  |
| `population` | integer | oui | `0` |
| `location` | geometry | oui |  |
| `boundary` | geometry | oui |  |
| `created_at` | timestamp with time zone | oui | `now()` |

### `report_events`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `report_id` | uuid | non |  |
| `event_type` | text | non |  |
| `from_status` | text | oui |  |
| `to_status` | text | oui |  |
| `actor_id` | uuid | oui |  |
| `comment` | text | oui |  |
| `created_at` | timestamp with time zone | oui | `now()` |

### `reports`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `reference` | text | oui |  |
| `category` | report_category | non |  |
| `title` | text | non |  |
| `description` | text | non |  |
| `status` | report_status | non | `'pending'::report_status` |
| `priority` | report_priority | non | `'medium'::report_priority` |
| `location` | geometry | oui |  |
| `address` | text | oui |  |
| `photo_url` | text | oui |  |
| `reporter_id` | uuid | oui | `auth.uid()` |
| `assigned_to` | uuid | oui |  |
| `commune_id` | uuid | oui |  |
| `province_id` | uuid | oui |  |
| `validated_by` | uuid | oui |  |
| `resolved_at` | timestamp with time zone | oui |  |
| `created_at` | timestamp with time zone | oui | `now()` |
| `updated_at` | timestamp with time zone | oui | `now()` |
| `is_demo` | boolean | non | `false` |

Contraintes CHECK / UNIQUE : `reports_reference_key` UNIQUE (reference)

### `security_cameras`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `name` | text | non |  |
| `location` | geometry | oui |  |
| `commune_id` | uuid | oui |  |
| `is_online` | boolean | oui | `true` |
| `is_recording` | boolean | oui | `true` |
| `resolution` | text | oui | `'1080p'::text` |
| `coverage_area` | text | oui |  |
| `last_heartbeat_at` | timestamp with time zone | oui |  |
| `created_at` | timestamp with time zone | oui | `now()` |

### `security_events`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | bigint | non | `nextval('security_events_id_seq'::regclass)` |
| `event_type` | text | non |  |
| `user_id` | uuid | oui |  |
| `ip_address` | text | oui |  |
| `user_agent` | text | oui |  |
| `details` | jsonb | non | `'{}'::jsonb` |
| `severity` | text | non | `'info'::text` |
| `created_at` | timestamp with time zone | non | `now()` |

### `security_patrols`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `unit_name` | text | non |  |
| `officer_count` | integer | oui | `1` |
| `location` | geometry | oui |  |
| `status` | text | oui | `'available'::text` |
| `commune_id` | uuid | oui |  |
| `shift_start` | timestamp with time zone | oui |  |
| `shift_end` | timestamp with time zone | oui |  |
| `created_at` | timestamp with time zone | oui | `now()` |

Contraintes CHECK / UNIQUE : `security_patrols_status_check` CHECK ((status = ANY (ARRAY['available'::text, 'on_patrol'::text, 'responding'::text, 'offline'::text])))

### `traffic_accidents`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `location` | geometry | non |  |
| `road_id` | uuid | oui |  |
| `severity` | text | oui | `'minor'::text` |
| `vehicles_involved` | integer | oui | `1` |
| `injuries` | integer | oui | `0` |
| `fatalities` | integer | oui | `0` |
| `description` | text | oui |  |
| `status` | text | oui | `'active'::text` |
| `reported_by` | uuid | oui |  |
| `occurred_at` | timestamp with time zone | oui | `now()` |
| `created_at` | timestamp with time zone | oui | `now()` |

Contraintes CHECK / UNIQUE : `traffic_accidents_severity_check` CHECK ((severity = ANY (ARRAY['minor'::text, 'moderate'::text, 'serious'::text, 'fatal'::text]))) ; `traffic_accidents_status_check` CHECK ((status = ANY (ARRAY['active'::text, 'cleared'::text, 'investigating'::text])))

### `traffic_cameras`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `device_id` | uuid | oui |  |
| `road_id` | uuid | oui |  |
| `location` | geometry | non |  |
| `stream_url` | text | oui |  |
| `status` | text | oui | `'offline'::text` |
| `vehicle_count` | integer | oui | `0` |
| `avg_speed_kmh` | integer | oui | `0` |
| `congestion_level` | text | oui | `'free'::text` |
| `last_update` | timestamp with time zone | oui |  |
| `created_at` | timestamp with time zone | oui | `now()` |

Contraintes CHECK / UNIQUE : `traffic_cameras_congestion_level_check` CHECK ((congestion_level = ANY (ARRAY['free'::text, 'moderate'::text, 'heavy'::text, 'jam'::text]))) ; `traffic_cameras_status_check` CHECK ((status = ANY (ARRAY['online'::text, 'offline'::text, 'maintenance'::text])))

### `traffic_roads`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `name` | text | non |  |
| `road_type` | text | oui | `'street'::text` |
| `path` | geometry | oui |  |
| `length_m` | integer | oui |  |
| `commune_id` | uuid | oui |  |
| `max_speed` | integer | oui | `50` |
| `lanes` | integer | oui | `2` |
| `created_at` | timestamp with time zone | oui | `now()` |

Contraintes CHECK / UNIQUE : `traffic_roads_road_type_check` CHECK ((road_type = ANY (ARRAY['highway'::text, 'avenue'::text, 'street'::text, 'roundabout'::text, 'bridge'::text])))

### `traffic_sensors`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `name` | text | non |  |
| `location` | geometry | oui |  |
| `commune_id` | uuid | oui |  |
| `road_name` | text | oui |  |
| `current_speed_kmh` | numeric | oui | `0` |
| `congestion_level` | congestion_level | oui | `'fluid'::congestion_level` |
| `vehicle_count` | integer | oui | `0` |
| `is_active` | boolean | oui | `true` |
| `last_reading_at` | timestamp with time zone | oui |  |
| `created_at` | timestamp with time zone | oui | `now()` |

### `waste_bins`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `device_id` | uuid | oui |  |
| `commune_id` | uuid | oui |  |
| `quartier_id` | uuid | oui |  |
| `location` | geometry | non |  |
| `capacity_liters` | integer | non | `1000` |
| `fill_percent` | integer | oui | `0` |
| `type` | text | oui | `'mixed'::text` |
| `status` | text | oui | `'empty'::text` |
| `last_emptied` | timestamp with time zone | oui |  |
| `created_at` | timestamp with time zone | oui | `now()` |

Contraintes CHECK / UNIQUE : `waste_bins_fill_percent_check` CHECK (((fill_percent >= 0) AND (fill_percent <= 100))) ; `waste_bins_status_check` CHECK ((status = ANY (ARRAY['empty'::text, 'filling'::text, 'full'::text, 'collected'::text, 'overflow'::text]))) ; `waste_bins_type_check` CHECK ((type = ANY (ARRAY['mixed'::text, 'organic'::text, 'recyclable'::text, 'hazardous'::text])))

### `waste_collections`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `bin_id` | uuid | non |  |
| `truck_id` | uuid | oui |  |
| `collected_liters` | integer | oui | `0` |
| `collected_at` | timestamp with time zone | oui | `now()` |
| `duration_min` | integer | oui |  |
| `created_at` | timestamp with time zone | oui | `now()` |

### `waste_trucks`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `plate` | text | non |  |
| `driver_name` | text | oui |  |
| `capacity_kg` | integer | oui | `5000` |
| `current_load_kg` | integer | oui | `0` |
| `location` | geometry | oui |  |
| `status` | text | oui | `'idle'::text` |
| `assigned_commune_id` | uuid | oui |  |
| `created_at` | timestamp with time zone | oui | `now()` |

Contraintes CHECK / UNIQUE : `waste_trucks_plate_key` UNIQUE (plate) ; `waste_trucks_status_check` CHECK ((status = ANY (ARRAY['idle'::text, 'en_route'::text, 'collecting'::text, 'returning'::text, 'maintenance'::text])))

### `water_assets`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `name` | text | non |  |
| `type` | water_asset_type | non |  |
| `location` | geometry | oui |  |
| `commune_id` | uuid | oui |  |
| `capacity_m3` | numeric | oui | `0` |
| `current_flow_m3h` | numeric | oui | `0` |
| `pressure_bar` | numeric | oui | `0` |
| `status` | water_status | oui | `'operational'::water_status` |
| `is_active` | boolean | oui | `true` |
| `last_reading_at` | timestamp with time zone | oui |  |
| `created_at` | timestamp with time zone | oui | `now()` |

### `water_leaks`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `location` | geometry | non |  |
| `station_id` | uuid | oui |  |
| `severity` | text | oui | `'minor'::text` |
| `flow_rate_lpm` | numeric | oui |  |
| `status` | text | oui | `'reported'::text` |
| `reported_by` | uuid | oui |  |
| `detected_at` | timestamp with time zone | oui | `now()` |
| `repaired_at` | timestamp with time zone | oui |  |
| `created_at` | timestamp with time zone | oui | `now()` |

Contraintes CHECK / UNIQUE : `water_leaks_severity_check` CHECK ((severity = ANY (ARRAY['minor'::text, 'moderate'::text, 'major'::text, 'critical'::text]))) ; `water_leaks_status_check` CHECK ((status = ANY (ARRAY['reported'::text, 'investigating'::text, 'repairing'::text, 'repaired'::text])))

### `water_reservoirs`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `name` | text | non |  |
| `location` | geometry | non |  |
| `capacity_m3` | integer | non |  |
| `current_level_m3` | integer | oui | `0` |
| `fill_percent` | numeric | oui | `0` |
| `status` | text | oui | `'normal'::text` |
| `commune_id` | uuid | oui |  |
| `created_at` | timestamp with time zone | oui | `now()` |

Contraintes CHECK / UNIQUE : `water_reservoirs_status_check` CHECK ((status = ANY (ARRAY['normal'::text, 'low'::text, 'critical'::text, 'overflow'::text, 'maintenance'::text])))

### `water_stations`

| Colonne | Type | NULL | Défaut |
|---|---|---|---|
| `id` | uuid | non | `gen_random_uuid()` |
| `name` | text | non |  |
| `type` | text | oui | `'treatment'::text` |
| `location` | geometry | non |  |
| `capacity_m3` | integer | oui |  |
| `current_output_m3h` | numeric | oui | `0` |
| `status` | text | oui | `'operational'::text` |
| `commune_id` | uuid | oui |  |
| `created_at` | timestamp with time zone | oui | `now()` |

Contraintes CHECK / UNIQUE : `water_stations_status_check` CHECK ((status = ANY (ARRAY['operational'::text, 'maintenance'::text, 'fault'::text, 'offline'::text]))) ; `water_stations_type_check` CHECK ((type = ANY (ARRAY['treatment'::text, 'pumping'::text, 'reservoir'::text, 'borehole'::text, 'spring'::text])))

## Types énumérés

- `bulb_type` : led, halogen, sodium
- `congestion_level` : fluid, moderate, heavy, congested
- `emergency_status` : active, dispatched, resolved
- `emergency_type` : security, fire, medical, natural, other
- `energy_asset_type` : substation, line, meter, transformer
- `gis_category` : traffic, waste, light, camera, hospital, police, water, power, incident
- `intervention_status` : assigned, accepted, in_progress, completed, cancelled
- `notification_type` : info, success, warning, error
- `operational_status` : operational, maintenance, outage
- `report_category` : traffic, waste, lighting, water, power, security, road, other
- `report_priority` : low, medium, high, critical
- `report_status` : pending, validated, assigned, in_progress, resolved, rejected
- `severity_level` : low, medium, high, critical
- `user_role` : admin, government, ministry, province, commune, police, agent, citizen, emergency, water, energy, waste, transport
- `water_asset_type` : station, reservoir, pipe, pump
- `water_status` : operational, maintenance, leak, outage

## Index (hors clés primaires)

- `ai_predictions` · `idx_ai_predictions_model` — `btree (model, created_at DESC)`
- `api_rate_limits` · `idx_api_rate_limits_key` — `btree (key, window_start DESC)`
- `audit_log` · `idx_audit_actor` — `btree (actor_id)`
- `audit_log` · `idx_audit_entity` — `btree (entity_type, entity_id)`
- `communes` · `communes_name_province_id_key` — `btree (name, province_id)`
- `communes` · `idx_communes_province` — `btree (province_id)`
- `emergency_incidents` · `idx_emergency_location` — `gist (location)`
- `emergency_incidents` · `idx_emergency_reporter` — `btree (reported_by)`
- `emergency_incidents` · `idx_emergency_status` — `btree (status)`
- `energy_assets` · `idx_energy_commune` — `btree (commune_id)`
- `energy_assets` · `idx_energy_location` — `gist (location)`
- `energy_stations` · `idx_energy_stations_location` — `gist (location)`
- `gis_points` · `idx_gis_category` — `btree (category)`
- `gis_points` · `idx_gis_commune` — `btree (commune_id)`
- `gis_points` · `idx_gis_location` — `gist (location)`
- `interventions` · `idx_interventions_agent` — `btree (agent_id)`
- `interventions` · `idx_interventions_report` — `btree (report_id)`
- `iot_devices` · `idx_iot_devices_location` — `gist (location)`
- `iot_devices` · `idx_iot_devices_status` — `btree (status)`
- `iot_devices` · `idx_iot_devices_type` — `btree (type)`
- `iot_devices` · `iot_devices_device_id_key` — `btree (device_id)`
- `iot_sensors` · `idx_iot_sensors_device` — `btree (device_id)`
- `iot_telemetry` · `idx_telemetry_device_time` — `btree (device_id, recorded_at DESC)`
- `iot_telemetry` · `idx_telemetry_metric_time` — `btree (metric, recorded_at DESC)`
- `iot_telemetry` · `idx_telemetry_real` — `btree (metric, recorded_at DESC) WHERE (is_simulated = false)`
- `iot_telemetry` · `uq_telemetry_replay` — `btree (device_id, metric, recorded_at)`
- `lighting_assets` · `idx_lighting_commune` — `btree (commune_id)`
- `lighting_assets` · `idx_lighting_location` — `gist (location)`
- `login_attempts` · `idx_login_attempts_created` — `btree (created_at DESC)`
- `login_attempts` · `idx_login_attempts_identifier` — `btree (identifier, created_at DESC)`
- `news_articles` · `idx_news_category` — `btree (category)`
- `news_articles` · `idx_news_created_at` — `btree (created_at DESC)`
- `notifications` · `idx_notifications_read` — `btree (user_id, read)`
- `notifications` · `idx_notifications_user` — `btree (user_id)`
- `profiles` · `idx_profiles_province` — `btree (province_id)`
- `profiles` · `idx_profiles_role` — `btree (role)`
- `provinces` · `provinces_code_key` — `btree (code)`
- `provinces` · `provinces_name_key` — `btree (name)`
- `report_events` · `idx_report_events_report` — `btree (report_id)`
- `reports` · `idx_reports_category` — `btree (category)`
- `reports` · `idx_reports_commune` — `btree (commune_id)`
- `reports` · `idx_reports_created` — `btree (created_at DESC)`
- `reports` · `idx_reports_is_demo` — `btree (is_demo)`
- `reports` · `idx_reports_location` — `gist (location)`
- `reports` · `idx_reports_reporter` — `btree (reporter_id)`
- `reports` · `idx_reports_status` — `btree (status)`
- `reports` · `reports_reference_key` — `btree (reference)`
- `security_cameras` · `idx_cameras_commune` — `btree (commune_id)`
- `security_cameras` · `idx_cameras_location` — `gist (location)`
- `security_events` · `idx_security_events_type` — `btree (event_type, created_at DESC)`
- `security_events` · `idx_security_events_user` — `btree (user_id, created_at DESC)`
- `traffic_accidents` · `idx_traffic_accidents_location` — `gist (location)`
- `traffic_roads` · `idx_traffic_roads_path` — `gist (path)`
- `traffic_sensors` · `idx_traffic_commune` — `btree (commune_id)`
- `traffic_sensors` · `idx_traffic_location` — `gist (location)`
- `waste_bins` · `idx_waste_bins_location` — `gist (location)`
- `waste_trucks` · `waste_trucks_plate_key` — `btree (plate)`
- `water_assets` · `idx_water_commune` — `btree (commune_id)`
- `water_assets` · `idx_water_location` — `gist (location)`
- `water_leaks` · `idx_water_leaks_location` — `gist (location)`
- `water_stations` · `idx_water_stations_location` — `gist (location)`

## Fonctions SQL

| Fonction | Retour | SECURITY | search_path | anon | authenticated | service_role |
|---|---|---|---|---|---|---|
| `profiles_guard_privileged()` | trigger | DEFINER | `search_path=public` | oui | oui | oui |
| `check_login_attempts(text,integer,integer)` | TABLE(locked boolean, attempts integer) | DEFINER | `search_path=public` | oui | oui | oui |
| `reports_after_update()` | trigger | DEFINER | `search_path=public` | oui | oui | oui |
| `is_admin()` | boolean | DEFINER | `search_path=public` | oui | oui | oui |
| `is_super_admin()` | boolean | DEFINER | `search_path=public` | oui | oui | oui |
| `admin_toggle_user_active(uuid,boolean)` | void | DEFINER | `search_path=public` | non | oui | oui |
| `get_devices_within_radius(double precision,double precision,integer)` | TABLE(id uuid, device_id text, name text, type text, status text, distance_m double precision, lat double precision, lng double precision) | invoker | `search_path=public, extensions` | oui | oui | oui |
| `get_gis_points_with_coords()` | TABLE(id uuid, category gis_category, name text, description text, commune_id uuid, status text, metadata jsonb, is_active boolean, lat double precision, lng double precision, is_demo boolean) | invoker | `search_path=public, extensions` | oui | oui | oui |
| `is_staff()` | boolean | DEFINER | `search_path=public` | oui | oui | oui |
| `check_rate_limit(text,integer,integer)` | TABLE(allowed boolean, remaining integer) | DEFINER | `search_path=public` | non | non | oui |
| `reports_before_insert()` | trigger | DEFINER | `search_path=public, extensions` | oui | oui | oui |
| `handle_new_user()` | trigger | DEFINER | `search_path=public` | oui | oui | oui |
| `log_audit_entry(uuid,text,text,uuid,jsonb,text)` | void | DEFINER | `search_path=public` | non | non | oui |
| `get_iot_devices_with_coords()` | TABLE(id uuid, device_id text, name text, type text, status text, battery_level integer, last_seen timestamp with time zone, lat double precision, lng double precision, commune_id uuid, metadata jsonb, is_simulated boolean) | invoker | `search_path=public, extensions` | oui | oui | oui |
| `record_login_attempt(text,boolean,text)` | void | DEFINER | `search_path=public` | oui | oui | oui |
| `get_current_user_role()` | text | DEFINER | `search_path=public` | oui | oui | oui |
| `admin_update_user_role(uuid,text)` | void | DEFINER | `search_path=public` | non | oui | oui |
| `get_reports_with_coords()` | TABLE(id uuid, reference text, category text, title text, status text, priority text, address text, created_at timestamp with time zone, is_demo boolean, lat double precision, lng double precision) | invoker | `search_path=public, extensions` | oui | oui | oui |
| `reports_before_update()` | trigger | DEFINER | `search_path=public` | oui | oui | oui |
| `log_security_event(text,uuid,text,text,jsonb,text)` | void | DEFINER | `search_path=public` | non | oui | oui |
| `reports_after_insert()` | trigger | DEFINER | `search_path=public` | oui | oui | oui |
| `update_updated_at()` | trigger | invoker | `—` | oui | oui | oui |
| `generate_report_reference()` | trigger | invoker | `—` | oui | oui | oui |

## Triggers

- `auth.users` · `on_auth_user_created` — AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user()
- `public.emergency_incidents` · `trg_emergency_updated` — BEFORE UPDATE ON public.emergency_incidents FOR EACH ROW EXECUTE FUNCTION update_updated_at()
- `public.gis_points` · `trg_gis_updated` — BEFORE UPDATE ON public.gis_points FOR EACH ROW EXECUTE FUNCTION update_updated_at()
- `public.interventions` · `trg_interventions_updated` — BEFORE UPDATE ON public.interventions FOR EACH ROW EXECUTE FUNCTION update_updated_at()
- `public.profiles` · `trg_profiles_guard_privileged` — BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION profiles_guard_privileged()
- `public.profiles` · `trg_profiles_updated` — BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at()
- `public.reports` · `trg_report_reference` — BEFORE INSERT ON public.reports FOR EACH ROW EXECUTE FUNCTION generate_report_reference()
- `public.reports` · `trg_reports_after_insert` — AFTER INSERT ON public.reports FOR EACH ROW EXECUTE FUNCTION reports_after_insert()
- `public.reports` · `trg_reports_after_update` — AFTER UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION reports_after_update()
- `public.reports` · `trg_reports_before_insert` — BEFORE INSERT ON public.reports FOR EACH ROW EXECUTE FUNCTION reports_before_insert()
- `public.reports` · `trg_reports_before_update` — BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION reports_before_update()
- `public.reports` · `trg_reports_updated` — BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION update_updated_at()

## Politiques RLS

| Table | Politique | Commande | Rôles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `ai_predictions` | `staff_read_ai_predictions` | SELECT | {authenticated} | `is_staff()` |  |
| `audit_log` | `admin_read_audit` | SELECT | {authenticated} | `is_super_admin()` |  |
| `communes` | `admin_delete_communes` | DELETE | {authenticated} | `is_admin()` |  |
| `communes` | `admin_insert_communes` | INSERT | {authenticated} |  | `is_admin()` |
| `communes` | `admin_update_communes` | UPDATE | {authenticated} | `is_admin()` | `is_admin()` |
| `communes` | `public_read_communes` | SELECT | {anon,authenticated} | `true` |  |
| `emergency_incidents` | `agent_update_emergency` | UPDATE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text, 'police'::text, 'emergency'::text]))` | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text, 'police'::text, 'emergency'::text]))` |
| `emergency_incidents` | `auth_read_emergency` | SELECT | {authenticated} | `true` |  |
| `emergency_incidents` | `citizen_insert_emergency` | INSERT | {authenticated} |  | `(auth.uid() = reported_by)` |
| `energy_assets` | `auth_delete_energy_assets` | DELETE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |  |
| `energy_assets` | `auth_insert_energy_assets` | INSERT | {authenticated} |  | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `energy_assets` | `auth_read_energy_assets` | SELECT | {authenticated} | `true` |  |
| `energy_assets` | `auth_update_energy_assets` | UPDATE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `energy_meters` | `em_read` | SELECT | {anon,authenticated} | `true` |  |
| `energy_meters` | `staff_delete_energy_meters` | DELETE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |  |
| `energy_meters` | `staff_insert_energy_meters` | INSERT | {authenticated} |  | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `energy_meters` | `staff_update_energy_meters` | UPDATE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `energy_outages` | `eo_read` | SELECT | {anon,authenticated} | `true` |  |
| `energy_outages` | `staff_delete_energy_outages` | DELETE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |  |
| `energy_outages` | `staff_insert_energy_outages` | INSERT | {authenticated} |  | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `energy_outages` | `staff_update_energy_outages` | UPDATE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `energy_stations` | `es_read` | SELECT | {anon,authenticated} | `true` |  |
| `energy_stations` | `staff_delete_energy_stations` | DELETE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |  |
| `energy_stations` | `staff_insert_energy_stations` | INSERT | {authenticated} |  | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `energy_stations` | `staff_update_energy_stations` | UPDATE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `gis_points` | `auth_delete_gis` | DELETE | {authenticated} | `is_admin()` |  |
| `gis_points` | `auth_insert_gis` | INSERT | {authenticated} |  | `is_admin()` |
| `gis_points` | `auth_update_gis` | UPDATE | {authenticated} | `is_admin()` | `is_admin()` |
| `gis_points` | `public_read_gis` | SELECT | {anon,authenticated} | `true` |  |
| `interventions` | `admin_delete_intervention` | DELETE | {authenticated} | `is_admin()` |  |
| `interventions` | `admin_insert_intervention` | INSERT | {authenticated} |  | `is_admin()` |
| `interventions` | `admin_update_intervention` | UPDATE | {authenticated} | `is_admin()` | `is_admin()` |
| `interventions` | `agent_update_intervention` | UPDATE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `interventions` | `read_staff_interventions` | SELECT | {authenticated} | `(is_staff() OR (agent_id = auth.uid()))` |  |
| `iot_devices` | `iot_delete` | DELETE | {authenticated} | `is_admin()` |  |
| `iot_devices` | `iot_insert` | INSERT | {authenticated} |  | `is_admin()` |
| `iot_devices` | `iot_read` | SELECT | {anon,authenticated} | `true` |  |
| `iot_devices` | `iot_update` | UPDATE | {authenticated} | `is_admin()` | `is_admin()` |
| `iot_sensors` | `sensors_read` | SELECT | {anon,authenticated} | `true` |  |
| `iot_sensors` | `staff_delete_iot_sensors` | DELETE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |  |
| `iot_sensors` | `staff_insert_iot_sensors` | INSERT | {authenticated} |  | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `iot_sensors` | `staff_update_iot_sensors` | UPDATE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `iot_telemetry` | `telemetry_read` | SELECT | {anon,authenticated} | `true` |  |
| `lighting_assets` | `auth_delete_lighting_assets` | DELETE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |  |
| `lighting_assets` | `auth_insert_lighting_assets` | INSERT | {authenticated} |  | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `lighting_assets` | `auth_read_lighting_assets` | SELECT | {authenticated} | `true` |  |
| `lighting_assets` | `auth_update_lighting_assets` | UPDATE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `login_attempts` | `login_attempts_delete` | DELETE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text]))` |  |
| `login_attempts` | `login_attempts_read` | SELECT | {authenticated} | `((identifier = ( SELECT users.email    FROM auth.users   WHERE (users.id = auth.uid()))) OR (get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text])))` |  |
| `news_articles` | `admin_read_all_news` | SELECT | {authenticated} | `is_admin()` |  |
| `news_articles` | `delete_news_authenticated` | DELETE | {authenticated} | `is_admin()` |  |
| `news_articles` | `insert_news_authenticated` | INSERT | {authenticated} |  | `is_admin()` |
| `news_articles` | `select_published_news` | SELECT | {anon,authenticated} | `(is_published = true)` |  |
| `news_articles` | `update_news_authenticated` | UPDATE | {authenticated} | `is_admin()` | `is_admin()` |
| `notifications` | `delete_own_notifications` | DELETE | {authenticated} | `(auth.uid() = user_id)` |  |
| `notifications` | `insert_own_notifications` | INSERT | {authenticated} |  | `(auth.uid() = user_id)` |
| `notifications` | `notifications_delete_own` | DELETE | {authenticated} | `((auth.uid() = user_id) OR is_admin())` |  |
| `notifications` | `notifications_insert_own` | INSERT | {authenticated} |  | `((auth.uid() = user_id) OR is_admin())` |
| `notifications` | `notifications_select_own` | SELECT | {authenticated} | `((auth.uid() = user_id) OR is_admin())` |  |
| `notifications` | `notifications_update_own` | UPDATE | {authenticated} | `((auth.uid() = user_id) OR is_admin())` | `((auth.uid() = user_id) OR is_admin())` |
| `notifications` | `read_own_notifications` | SELECT | {authenticated} | `(auth.uid() = user_id)` |  |
| `notifications` | `update_own_notifications` | UPDATE | {authenticated} | `(auth.uid() = user_id)` | `(auth.uid() = user_id)` |
| `profiles` | `admin_delete_profile` | DELETE | {authenticated} | `is_admin()` |  |
| `profiles` | `admin_insert_profile` | INSERT | {authenticated} |  | `is_admin()` |
| `profiles` | `admin_select_all_profiles` | SELECT | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text]))` |  |
| `profiles` | `admin_update_profile` | UPDATE | {authenticated} | `is_admin()` | `is_admin()` |
| `profiles` | `insert_own_profile` | INSERT | {authenticated} |  | `((auth.uid() = id) AND (role = 'citizen'::user_role))` |
| `profiles` | `select_own_profile` | SELECT | {authenticated} | `((auth.uid() = id) OR is_admin())` |  |
| `profiles` | `update_own_profile` | UPDATE | {authenticated} | `(auth.uid() = id)` | `((auth.uid() = id) AND (is_admin() OR (role = (get_current_user_role())::user_role)))` |
| `provinces` | `admin_delete_provinces` | DELETE | {authenticated} | `is_admin()` |  |
| `provinces` | `admin_insert_provinces` | INSERT | {authenticated} |  | `is_admin()` |
| `provinces` | `admin_update_provinces` | UPDATE | {authenticated} | `is_admin()` | `is_admin()` |
| `provinces` | `public_read_provinces` | SELECT | {anon,authenticated} | `true` |  |
| `quartiers` | `quartiers_delete` | DELETE | {authenticated} | `is_admin()` |  |
| `quartiers` | `quartiers_read` | SELECT | {anon,authenticated} | `true` |  |
| `quartiers` | `quartiers_update` | UPDATE | {authenticated} | `is_admin()` | `is_admin()` |
| `quartiers` | `quartiers_write` | INSERT | {authenticated} |  | `is_admin()` |
| `report_events` | `insert_event` | INSERT | {authenticated} |  | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `report_events` | `read_own_or_staff_events` | SELECT | {authenticated} | `(is_staff() OR (EXISTS ( SELECT 1    FROM reports r   WHERE ((r.id = report_events.report_id) AND (r.reporter_id = auth.uid())))))` |  |
| `reports` | `admin_delete_report` | DELETE | {authenticated} | `is_admin()` |  |
| `reports` | `admin_update_report` | UPDATE | {authenticated} | `is_admin()` | `is_admin()` |
| `reports` | `agent_update_report` | UPDATE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `reports` | `citizen_insert_report` | INSERT | {authenticated} |  | `(auth.uid() = reporter_id)` |
| `reports` | `read_own_or_staff_reports` | SELECT | {authenticated} | `((reporter_id = auth.uid()) OR is_staff())` |  |
| `security_cameras` | `auth_delete_security_cameras` | DELETE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |  |
| `security_cameras` | `auth_insert_security_cameras` | INSERT | {authenticated} |  | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `security_cameras` | `auth_read_security_cameras` | SELECT | {authenticated} | `true` |  |
| `security_cameras` | `auth_update_security_cameras` | UPDATE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `security_events` | `security_events_read` | SELECT | {authenticated} | `((user_id = auth.uid()) OR (get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text])))` |  |
| `security_patrols` | `sp_read` | SELECT | {anon,authenticated} | `true` |  |
| `security_patrols` | `staff_delete_security_patrols` | DELETE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |  |
| `security_patrols` | `staff_insert_security_patrols` | INSERT | {authenticated} |  | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `security_patrols` | `staff_update_security_patrols` | UPDATE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `traffic_accidents` | `acc_read` | SELECT | {anon,authenticated} | `true` |  |
| `traffic_accidents` | `staff_delete_traffic_accidents` | DELETE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |  |
| `traffic_accidents` | `staff_insert_traffic_accidents` | INSERT | {authenticated} |  | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `traffic_accidents` | `staff_update_traffic_accidents` | UPDATE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `traffic_cameras` | `staff_delete_traffic_cameras` | DELETE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |  |
| `traffic_cameras` | `staff_insert_traffic_cameras` | INSERT | {authenticated} |  | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `traffic_cameras` | `staff_update_traffic_cameras` | UPDATE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `traffic_cameras` | `tcam_read` | SELECT | {anon,authenticated} | `true` |  |
| `traffic_roads` | `roads_read` | SELECT | {anon,authenticated} | `true` |  |
| `traffic_roads` | `staff_delete_traffic_roads` | DELETE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |  |
| `traffic_roads` | `staff_insert_traffic_roads` | INSERT | {authenticated} |  | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `traffic_roads` | `staff_update_traffic_roads` | UPDATE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `traffic_sensors` | `auth_delete_traffic_sensors` | DELETE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |  |
| `traffic_sensors` | `auth_insert_traffic_sensors` | INSERT | {authenticated} |  | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `traffic_sensors` | `auth_read_traffic_sensors` | SELECT | {authenticated} | `true` |  |
| `traffic_sensors` | `auth_update_traffic_sensors` | UPDATE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `waste_bins` | `bins_read` | SELECT | {anon,authenticated} | `true` |  |
| `waste_bins` | `staff_delete_waste_bins` | DELETE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |  |
| `waste_bins` | `staff_insert_waste_bins` | INSERT | {authenticated} |  | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `waste_bins` | `staff_update_waste_bins` | UPDATE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `waste_collections` | `collections_read` | SELECT | {anon,authenticated} | `true` |  |
| `waste_collections` | `staff_delete_waste_collections` | DELETE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |  |
| `waste_collections` | `staff_insert_waste_collections` | INSERT | {authenticated} |  | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `waste_collections` | `staff_update_waste_collections` | UPDATE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `waste_trucks` | `staff_delete_waste_trucks` | DELETE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |  |
| `waste_trucks` | `staff_insert_waste_trucks` | INSERT | {authenticated} |  | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `waste_trucks` | `staff_update_waste_trucks` | UPDATE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `waste_trucks` | `trucks_read` | SELECT | {anon,authenticated} | `true` |  |
| `water_assets` | `auth_delete_water_assets` | DELETE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |  |
| `water_assets` | `auth_insert_water_assets` | INSERT | {authenticated} |  | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `water_assets` | `auth_read_water_assets` | SELECT | {authenticated} | `true` |  |
| `water_assets` | `auth_update_water_assets` | UPDATE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `water_leaks` | `staff_delete_water_leaks` | DELETE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |  |
| `water_leaks` | `staff_insert_water_leaks` | INSERT | {authenticated} |  | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `water_leaks` | `staff_update_water_leaks` | UPDATE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `water_leaks` | `wl_read` | SELECT | {anon,authenticated} | `true` |  |
| `water_reservoirs` | `staff_delete_water_reservoirs` | DELETE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |  |
| `water_reservoirs` | `staff_insert_water_reservoirs` | INSERT | {authenticated} |  | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `water_reservoirs` | `staff_update_water_reservoirs` | UPDATE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `water_reservoirs` | `wr_read` | SELECT | {anon,authenticated} | `true` |  |
| `water_stations` | `staff_delete_water_stations` | DELETE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |  |
| `water_stations` | `staff_insert_water_stations` | INSERT | {authenticated} |  | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `water_stations` | `staff_update_water_stations` | UPDATE | {authenticated} | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` | `(get_current_user_role() = ANY (ARRAY['admin'::text, 'government'::text, 'ministry'::text, 'province'::text, 'commune'::text, 'agent'::text]))` |
| `water_stations` | `ws_read` | SELECT | {anon,authenticated} | `true` |  |

## Publication Realtime

- `emergency_incidents`
- `gis_points`
- `iot_devices`
- `iot_telemetry`
- `notifications`
- `reports`

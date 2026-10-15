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

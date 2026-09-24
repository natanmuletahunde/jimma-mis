import { Router } from "express";
import { db, pool } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// GET /api/spatial/status - Check PostGIS installation, version, and spatial stats
router.get("/status", requireAuth, async (_req, res) => {
  try {
    const versionRes = await pool.query("SELECT PostGIS_Version(), PostGIS_Full_Version();");
    const countsRes = await pool.query(`
      SELECT 
        (SELECT count(*) FROM properties WHERE geom IS NOT NULL) as properties_with_geom,
        (SELECT count(*) FROM streets WHERE geom IS NOT NULL) as streets_with_geom,
        (SELECT count(*) FROM land_parcels WHERE centroid_geom IS NOT NULL) as parcels_with_geom,
        (SELECT count(*) FROM kebeles WHERE boundary_geom IS NOT NULL) as kebeles_with_geom;
    `);

    res.json({
      postgisInstalled: true,
      version: versionRes.rows[0]?.postgis_version,
      fullVersion: versionRes.rows[0]?.postgis_full_version?.split("\n")[0],
      srid: 4326,
      spatialStats: {
        propertiesWithGeom: parseInt(countsRes.rows[0]?.properties_with_geom || "0", 10),
        streetsWithGeom: parseInt(countsRes.rows[0]?.streets_with_geom || "0", 10),
        parcelsWithGeom: parseInt(countsRes.rows[0]?.parcels_with_geom || "0", 10),
        kebelesWithGeom: parseInt(countsRes.rows[0]?.kebeles_with_geom || "0", 10),
      },
    });
  } catch (err: any) {
    console.error("Failed to get PostGIS status:", err);
    res.status(500).json({ error: "Failed to retrieve PostGIS spatial status", details: err.message });
  }
});

// POST /api/spatial/detect-kebele - Auto-detect kebele for given GPS coordinate using ST_Contains
router.post("/detect-kebele", requireAuth, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: "Latitude and longitude are required" });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: "Invalid coordinate values" });
    }

    // 1. Check exact containment: ST_Contains(kebele.boundary_geom, Point(lng, lat))
    const containQuery = `
      SELECT id, name, code, city, district
      FROM kebeles
      WHERE boundary_geom IS NOT NULL 
        AND ST_Contains(boundary_geom, ST_SetSRID(ST_MakePoint($1, $2), 4326))
      LIMIT 1;
    `;
    const containRes = await pool.query(containQuery, [lng, lat]);

    if (containRes.rows.length > 0) {
      return res.json({
        matched: true,
        method: "ST_Contains",
        kebele: containRes.rows[0],
      });
    }

    // 2. If not strictly inside any polygon, find closest kebele boundary using ST_Distance
    const closestQuery = `
      SELECT id, name, code, city, district,
             ROUND(ST_Distance(boundary_geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)::numeric, 1) as distance_meters
      FROM kebeles
      WHERE boundary_geom IS NOT NULL
      ORDER BY ST_Distance(boundary_geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) ASC
      LIMIT 1;
    `;
    const closestRes = await pool.query(closestQuery, [lng, lat]);

    if (closestRes.rows.length > 0) {
      return res.json({
        matched: false,
        method: "ST_Distance (Closest)",
        kebele: closestRes.rows[0],
        distanceMeters: closestRes.rows[0].distance_meters,
      });
    }

    res.status(404).json({ error: "No spatial kebele boundaries configured" });
  } catch (err: any) {
    console.error("Failed to detect kebele:", err);
    res.status(500).json({ error: "Spatial kebele detection failed", details: err.message });
  }
});

// GET /api/spatial/nearby - Search properties within radius using ST_DWithin
router.get("/nearby", requireAuth, async (req, res) => {
  try {
    const lat = parseFloat(req.query.latitude as string);
    const lng = parseFloat(req.query.longitude as string);
    const radius = Math.min(10000, Math.max(10, parseFloat((req.query.radius as string) || "500")));

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: "Valid latitude and longitude query parameters are required" });
    }

    const nearbyQuery = `
      SELECT id, address_code, owner_name, owner_phone, property_type, building_use, status, latitude, longitude,
             ROUND(ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)::numeric, 1) as distance_meters
      FROM properties
      WHERE geom IS NOT NULL
        AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
      ORDER BY distance_meters ASC
      LIMIT 50;
    `;

    const result = await pool.query(nearbyQuery, [lng, lat, radius]);

    res.json({
      center: { latitude: lat, longitude: lng },
      radiusMeters: radius,
      count: result.rows.length,
      properties: result.rows,
    });
  } catch (err: any) {
    console.error("Nearby search failed:", err);
    res.status(500).json({ error: "Spatial radius search failed", details: err.message });
  }
});

// POST /api/spatial/check-overlap - Check if parcel polygon intersects existing parcels (ST_Intersects)
router.post("/check-overlap", requireAuth, async (req, res) => {
  try {
    const { minLat, minLng, maxLat, maxLng, excludeParcelId } = req.body;
    if (minLat == null || minLng == null || maxLat == null || maxLng == null) {
      return res.status(400).json({ error: "Bounding box coordinates (minLat, minLng, maxLat, maxLng) are required" });
    }

    const bboxPolyWkt = `POLYGON((${minLng} ${minLat}, ${maxLng} ${minLat}, ${maxLng} ${maxLat}, ${minLng} ${maxLat}, ${minLng} ${minLat}))`;

    const overlapQuery = `
      SELECT id, parcel_upi, kebele, block_code, area_sqm,
             ST_AsGeoJSON(boundary_geom) as boundary_geojson
      FROM land_parcels
      WHERE boundary_geom IS NOT NULL
        ${excludeParcelId ? `AND id != ${parseInt(excludeParcelId, 10)}` : ""}
        AND ST_Intersects(boundary_geom, ST_SetSRID(ST_GeomFromText($1), 4326))
      LIMIT 10;
    `;

    const result = await pool.query(overlapQuery, [bboxPolyWkt]);

    res.json({
      hasOverlap: result.rows.length > 0,
      overlappingParcelsCount: result.rows.length,
      overlappingParcels: result.rows,
    });
  } catch (err: any) {
    console.error("Overlap check failed:", err);
    res.status(500).json({ error: "Spatial boundary overlap check failed", details: err.message });
  }
});

// GET /api/spatial/streets-geojson - Return all street corridors as a native GeoJSON FeatureCollection
router.get("/streets-geojson", async (_req, res) => {
  try {
    const query = `
      SELECT jsonb_build_object(
        'type', 'FeatureCollection',
        'features', COALESCE(jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'id', id,
            'geometry', ST_AsGeoJSON(geom)::jsonb,
            'properties', jsonb_build_object(
              'id', id,
              'name', name,
              'code', code,
              'roadSurface', road_surface,
              'streetType', street_type,
              'lengthMeters', length_meters,
              'widthMeters', width_meters,
              'lanes', lanes,
              'condition', condition,
              'lastPciScore', last_pci_score,
              'lastPciRating', last_pci_rating,
              'hasSidewalk', has_sidewalk,
              'hasStreetLights', has_street_lights,
              'hasDrainage', has_drainage
            )
          )
        ), '[]'::jsonb)
      ) as geojson
      FROM streets
      WHERE geom IS NOT NULL;
    `;
    const result = await pool.query(query);
    res.json(result.rows[0]?.geojson || { type: "FeatureCollection", features: [] });
  } catch (err: any) {
    console.error("Failed to generate GeoJSON:", err);
    res.status(500).json({ error: "Failed to generate street GeoJSON", details: err.message });
  }
});

export default router;

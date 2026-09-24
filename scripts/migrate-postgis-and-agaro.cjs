const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log("=== Starting PostGIS & Agaro City Migration ===");
  const client = await pool.connect();

  try {
    // 1. Enable PostGIS Extension
    console.log("1. Ensuring PostGIS extension is installed...");
    await client.query("CREATE EXTENSION IF NOT EXISTS postgis;");
    const versionRes = await client.query("SELECT PostGIS_Full_Version();");
    console.log("   PostGIS Active:", versionRes.rows[0].postgis_full_version.split("\n")[0]);

    // 2. Add native geometry columns to tables
    console.log("2. Adding native PostGIS geometry columns...");

    // properties: Point geometry (SRID 4326 - WGS 84 GPS standard)
    await client.query(`
      ALTER TABLE properties 
      ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);
    `);

    // streets: LineString geometry
    await client.query(`
      ALTER TABLE streets 
      ADD COLUMN IF NOT EXISTS geom geometry(LineString, 4326);
    `);

    // land_parcels: centroid Point and boundary Polygon geometries
    await client.query(`
      ALTER TABLE land_parcels 
      ADD COLUMN IF NOT EXISTS centroid_geom geometry(Point, 4326),
      ADD COLUMN IF NOT EXISTS boundary_geom geometry(Polygon, 4326);
    `);

    // kebeles: boundary Polygon geometry
    await client.query(`
      ALTER TABLE kebeles 
      ADD COLUMN IF NOT EXISTS boundary_geom geometry(Polygon, 4326);
    `);

    // 3. Create Spatial Indexes (GIST) for high-performance spatial queries
    console.log("3. Creating high-performance GIST spatial indexes...");
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_properties_geom ON properties USING GIST (geom);
      CREATE INDEX IF NOT EXISTS idx_streets_geom ON streets USING GIST (geom);
      CREATE INDEX IF NOT EXISTS idx_land_parcels_centroid ON land_parcels USING GIST (centroid_geom);
      CREATE INDEX IF NOT EXISTS idx_land_parcels_boundary ON land_parcels USING GIST (boundary_geom);
      CREATE INDEX IF NOT EXISTS idx_kebeles_boundary ON kebeles USING GIST (boundary_geom);
    `);

    // 4. Backfill existing geometries from latitude/longitude coordinates
    console.log("4. Backfilling existing coordinates into PostGIS geometries...");

    // Properties points
    await client.query(`
      UPDATE properties 
      SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
    `);

    // Streets LineStrings
    await client.query(`
      UPDATE streets 
      SET geom = ST_SetSRID(ST_MakeLine(ST_MakePoint(start_lng, start_lat), ST_MakePoint(end_lng, end_lat)), 4326)
      WHERE start_lat IS NOT NULL AND start_lng IS NOT NULL 
        AND end_lat IS NOT NULL AND end_lng IS NOT NULL;
    `);

    // Land Parcels centroids & generated rectangular bounding parcels
    await client.query(`
      UPDATE land_parcels 
      SET centroid_geom = ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326),
          boundary_geom = ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
            ST_MakePoint(center_lng - 0.0002, center_lat - 0.0002),
            ST_MakePoint(center_lng + 0.0002, center_lat - 0.0002),
            ST_MakePoint(center_lng + 0.0002, center_lat + 0.0002),
            ST_MakePoint(center_lng - 0.0002, center_lat + 0.0002),
            ST_MakePoint(center_lng - 0.0002, center_lat - 0.0002)
          ])), 4326)
      WHERE center_lat IS NOT NULL AND center_lng IS NOT NULL;
    `);

    // 5. Automatic Synchronization Triggers
    console.log("5. Setting up PostgreSQL trigger functions for real-time geometry synchronization...");
    await client.query(`
      CREATE OR REPLACE FUNCTION sync_property_geometry()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
          NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
        ELSE
          NEW.geom := NULL;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_sync_property_geom ON properties;
      CREATE TRIGGER trg_sync_property_geom
      BEFORE INSERT OR UPDATE OF latitude, longitude ON properties
      FOR EACH ROW EXECUTE FUNCTION sync_property_geometry();

      CREATE OR REPLACE FUNCTION sync_street_geometry()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.start_lat IS NOT NULL AND NEW.start_lng IS NOT NULL 
           AND NEW.end_lat IS NOT NULL AND NEW.end_lng IS NOT NULL THEN
          NEW.geom := ST_SetSRID(ST_MakeLine(ST_MakePoint(NEW.start_lng, NEW.start_lat), ST_MakePoint(NEW.end_lng, NEW.end_lat)), 4326);
        ELSE
          NEW.geom := NULL;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_sync_street_geom ON streets;
      CREATE TRIGGER trg_sync_street_geom
      BEFORE INSERT OR UPDATE OF start_lat, start_lng, end_lat, end_lng ON streets
      FOR EACH ROW EXECUTE FUNCTION sync_street_geometry();
    `);

    // 6. City Identity Update: Adapt to Agaro City (AGA-)
    console.log("6. Updating City Identity: Adapting to Agaro City (AGA-)...");

    // Update existing address codes: JIM- -> AGA-
    const propCodeUpdate = await client.query(`
      UPDATE properties 
      SET address_code = regexp_replace(address_code, '^JIM-', 'AGA-')
      WHERE address_code LIKE 'JIM-%'
      RETURNING id, address_code;
    `);
    console.log(`   Updated ${propCodeUpdate.rowCount} property address codes to AGA- prefix.`);

    // Update existing land parcel UPIs: ET-OR-JMA- -> ET-OR-AGA-
    const parcelUpiUpdate = await client.query(`
      UPDATE land_parcels 
      SET parcel_upi = regexp_replace(parcel_upi, '^ET-OR-JMA-', 'ET-OR-AGA-')
      WHERE parcel_upi LIKE 'ET-OR-JMA-%'
      RETURNING id, parcel_upi;
    `);
    console.log(`   Updated ${parcelUpiUpdate.rowCount} cadastral parcel UPIs to ET-OR-AGA- prefix.`);

    // Update existing building codes: BLD-JMA- -> BLD-AGA-
    const bldCodeUpdate = await client.query(`
      UPDATE buildings 
      SET building_code = regexp_replace(building_code, '^BLD-JMA-', 'BLD-AGA-')
      WHERE building_code LIKE 'BLD-JMA-%'
      RETURNING id, building_code;
    `);
    console.log(`   Updated ${bldCodeUpdate.rowCount} building codes to BLD-AGA- prefix.`);

    // 7. Seed Agaro City Kebeles with Spatial Boundary Polygons
    console.log("7. Seeding Agaro City administrative Kebeles with PostGIS boundary polygons...");

    // Agaro coordinates roughly center at Lat 7.8540, Lng 36.6500
    const agaroKebeles = [
      {
        name: "Kebele 01",
        code: "KB01",
        city: "Agaro",
        district: "Jimma Zone",
        // Polygon box: [lng_min, lat_min, lng_max, lat_max]
        poly: [36.640, 7.854, 36.660, 7.870],
      },
      {
        name: "Kebele 02",
        code: "KB02",
        city: "Agaro",
        district: "Jimma Zone",
        poly: [36.655, 7.845, 36.675, 7.860],
      },
      {
        name: "Kebele 03",
        code: "KB03",
        city: "Agaro",
        district: "Jimma Zone",
        poly: [36.640, 7.835, 36.660, 7.850],
      },
      {
        name: "Kebele 04",
        code: "KB04",
        city: "Agaro",
        district: "Jimma Zone",
        poly: [36.625, 7.845, 36.645, 7.860],
      },
      {
        name: "Kebele 05",
        code: "KB05",
        city: "Agaro",
        district: "Jimma Zone",
        poly: [36.642, 7.848, 36.658, 7.858],
      },
    ];

    for (const kb of agaroKebeles) {
      const [x1, y1, x2, y2] = kb.poly;
      const polyWkt = `POLYGON((${x1} ${y1}, ${x2} ${y1}, ${x2} ${y2}, ${x1} ${y2}, ${x1} ${y1}))`;
      await client.query(`
        INSERT INTO kebeles (name, code, city, district, status, boundary_geom)
        VALUES ($1, $2, $3, $4, 'active', ST_SetSRID(ST_GeomFromText($5), 4326))
        ON CONFLICT (code) DO UPDATE 
        SET name = EXCLUDED.name,
            city = EXCLUDED.city,
            district = EXCLUDED.district,
            boundary_geom = EXCLUDED.boundary_geom;
      `, [kb.name, kb.code, kb.city, kb.district, polyWkt]);
    }
    console.log("   Inserted/Updated 5 official Agaro City Kebeles (KB01 - KB05) with boundary polygons.");

    console.log("=== PostGIS & Agaro Migration Completed Successfully! ===");
  } catch (err) {
    console.error("Migration failed:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main();

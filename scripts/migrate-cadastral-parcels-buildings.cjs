const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log("Connecting to PostgreSQL for Cadastral & Building migration...");
  const client = await pool.connect();
  try {
    console.log("1. Creating 'land_parcels' table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS land_parcels (
        id SERIAL PRIMARY KEY,
        parcel_upi TEXT NOT NULL UNIQUE,
        kebele_id INTEGER REFERENCES kebeles(id) ON DELETE RESTRICT,
        kebele TEXT NOT NULL,
        block_code TEXT,
        street_id INTEGER REFERENCES streets(id) ON DELETE SET NULL,
        street_name TEXT,
        area_sqm REAL,
        land_tenure TEXT NOT NULL DEFAULT 'leasehold',
        title_deed_number TEXT,
        zoning_classification TEXT NOT NULL DEFAULT 'residential',
        center_lat REAL,
        center_lng REAL,
        boundary_polygon TEXT,
        status TEXT NOT NULL DEFAULT 'registered',
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS land_parcels_upi_idx ON land_parcels(parcel_upi);
      CREATE INDEX IF NOT EXISTS land_parcels_kebele_idx ON land_parcels(kebele);
      CREATE INDEX IF NOT EXISTS land_parcels_status_idx ON land_parcels(status);
      CREATE INDEX IF NOT EXISTS land_parcels_zoning_idx ON land_parcels(zoning_classification);
    `);

    console.log("2. Creating 'buildings' table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS buildings (
        id SERIAL PRIMARY KEY,
        building_code TEXT NOT NULL UNIQUE,
        parcel_id INTEGER REFERENCES land_parcels(id) ON DELETE CASCADE,
        building_name TEXT,
        structure_type TEXT NOT NULL DEFAULT 'reinforced_concrete',
        foundation_type TEXT,
        roof_material TEXT,
        construction_year INTEGER,
        number_of_floors INTEGER NOT NULL DEFAULT 1,
        footprint_area_sqm REAL,
        total_floor_area_sqm REAL,
        building_use TEXT NOT NULL DEFAULT 'residential',
        building_condition TEXT NOT NULL DEFAULT 'good',
        has_building_permit BOOLEAN DEFAULT true,
        permit_number TEXT,
        latitude REAL,
        longitude REAL,
        photo_url TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS buildings_code_idx ON buildings(building_code);
      CREATE INDEX IF NOT EXISTS buildings_parcel_id_idx ON buildings(parcel_id);
      CREATE INDEX IF NOT EXISTS buildings_status_idx ON buildings(status);
      CREATE INDEX IF NOT EXISTS buildings_use_idx ON buildings(building_use);
    `);

    console.log("3. Altering 'properties' table to add relational foreign keys...");
    await client.query(`
      ALTER TABLE properties
        ADD COLUMN IF NOT EXISTS parcel_id INTEGER REFERENCES land_parcels(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS building_id INTEGER REFERENCES buildings(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS unit_number TEXT;

      CREATE INDEX IF NOT EXISTS properties_parcel_id_idx ON properties(parcel_id);
      CREATE INDEX IF NOT EXISTS properties_building_id_idx ON properties(building_id);
    `);

    console.log("4. Backfilling parcels & buildings from existing properties...");
    const { rows: props } = await client.query(`
      SELECT id, kebele, street_name, block_code, house_number, building_name,
             number_of_floors, building_use, property_type, latitude, longitude,
             created_by, parcel_id, building_id
      FROM properties
      ORDER BY id ASC;
    `);

    console.log(`Found ${props.length} properties in the database.`);

    for (const prop of props) {
      if (prop.parcel_id && prop.building_id) {
        continue; // Already migrated
      }

      const kebeleCode = (prop.kebele || "JMA").replace(/\s+/g, "").toUpperCase().slice(0, 4);
      const blkCode = (prop.block_code || "BL01").replace(/\s+/g, "").toUpperCase();
      const upi = `JMA-${kebeleCode}-${blkCode}-P${String(prop.id).padStart(4, "0")}`;
      const deedNo = `TD-${kebeleCode}-${2020 + (prop.id % 5)}-${String(1000 + prop.id)}`;
      const area = 180.0 + ((prop.id * 37) % 350);

      let zoning = "residential";
      if (prop.propertyType === "commercial") zoning = "commercial";
      else if (prop.propertyType === "mixed") zoning = "mixed_use";
      else if (prop.propertyType === "government") zoning = "public_civic";

      // 1) Insert or get parcel
      let parcelId = prop.parcel_id;
      if (!parcelId) {
        // Try finding matching kebele id
        const { rows: kebRows } = await client.query(
          "SELECT id FROM kebeles WHERE name ILIKE $1 OR code ILIKE $1 LIMIT 1",
          [prop.kebele]
        );
        const kebeleId = kebRows.length > 0 ? kebRows[0].id : null;

        // Try finding matching street id
        const { rows: stRows } = await client.query(
          "SELECT id FROM streets WHERE name ILIKE $1 LIMIT 1",
          [prop.street_name]
        );
        const streetId = stRows.length > 0 ? stRows[0].id : null;

        const { rows: parcelRows } = await client.query(`
          INSERT INTO land_parcels (
            parcel_upi, kebele_id, kebele, block_code, street_id, street_name,
            area_sqm, land_tenure, title_deed_number, zoning_classification,
            center_lat, center_lng, status, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'registered', $13)
          ON CONFLICT (parcel_upi) DO UPDATE SET updated_at = NOW()
          RETURNING id;
        `, [
          upi,
          kebeleId,
          prop.kebele || "Jimma",
          prop.block_code || "BL01",
          streetId,
          prop.street_name || "Main Road",
          area,
          "leasehold",
          deedNo,
          zoning,
          prop.latitude || 7.673,
          prop.longitude || 36.834,
          prop.created_by,
        ]);

        parcelId = parcelRows[0].id;
      }

      // 2) Insert or get building
      let buildingId = prop.building_id;
      if (!buildingId) {
        const bldCode = `BLD-JMA-${kebeleCode}-${String(prop.id).padStart(4, "0")}-B1`;
        const bldName = prop.building_name || `Building ${prop.houseNumber || prop.id}`;
        const floors = prop.number_of_floors || (prop.propertyType === "commercial" ? 3 : 1);
        const footprint = Math.round(area * 0.6);
        const totalFloorArea = footprint * floors;

        const { rows: bldRows } = await client.query(`
          INSERT INTO buildings (
            building_code, parcel_id, building_name, structure_type, foundation_type,
            roof_material, construction_year, number_of_floors, footprint_area_sqm,
            total_floor_area_sqm, building_use, building_condition, has_building_permit,
            permit_number, latitude, longitude, status, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, $13, $14, $15, 'active', $16)
          ON CONFLICT (building_code) DO UPDATE SET updated_at = NOW()
          RETURNING id;
        `, [
          bldCode,
          parcelId,
          bldName,
          floors > 1 ? "reinforced_concrete" : "masonry_stone",
          "strip_footing",
          "corrugated_iron_sheet",
          2018 + (prop.id % 6),
          floors,
          footprint,
          totalFloorArea,
          prop.building_use || prop.propertyType || "residential",
          "good",
          `BP-JMA-${2020 + (prop.id % 4)}-${String(500 + prop.id)}`,
          prop.latitude || 7.673,
          prop.longitude || 36.834,
          prop.created_by,
        ]);

        buildingId = bldRows[0].id;
      }

      // 3) Update property link
      await client.query(`
        UPDATE properties
        SET parcel_id = $1, building_id = $2, unit_number = COALESCE(unit_number, $3)
        WHERE id = $4;
      `, [parcelId, buildingId, `Unit ${prop.houseNumber || '1'}`, prop.id]);
    }

    console.log("Migration and backfill completed successfully!");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

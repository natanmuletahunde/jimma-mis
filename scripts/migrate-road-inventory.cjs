const pg = require('pg');

async function migrate() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected to Neon PostgreSQL database.');

  // Add the municipal road inventory attributes
  await client.query(`
    ALTER TABLE streets 
    ADD COLUMN IF NOT EXISTS width_meters REAL,
    ADD COLUMN IF NOT EXISTS start_intersection TEXT,
    ADD COLUMN IF NOT EXISTS end_intersection TEXT,
    ADD COLUMN IF NOT EXISTS lanes INTEGER DEFAULT 2,
    ADD COLUMN IF NOT EXISTS has_sidewalk BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS has_street_lights BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS has_drainage BOOLEAN DEFAULT false;
  `);
  console.log('Added width_meters, intersections, lanes, and infrastructure flags to streets table.');

  // Backfill sample data for existing streets
  await client.query(`
    UPDATE streets SET 
      width_meters = 20, 
      start_intersection = 'Aba Jifar Roundabout', 
      end_intersection = 'Bonga Checkpoint',
      lanes = 4,
      has_sidewalk = true,
      has_street_lights = true,
      has_drainage = true
    WHERE id = 1;

    UPDATE streets SET 
      width_meters = 14, 
      start_intersection = 'Jimma Stadium Gate 1', 
      end_intersection = 'Youth Center Junction',
      lanes = 2,
      has_sidewalk = true,
      has_street_lights = true,
      has_drainage = true
    WHERE id = 2;

    UPDATE streets SET 
      width_meters = 8, 
      start_intersection = 'Old Market Entrance', 
      end_intersection = 'Grain Mill Lane',
      lanes = 1,
      has_sidewalk = false,
      has_street_lights = false,
      has_drainage = false
    WHERE id = 3;

    UPDATE streets SET 
      width_meters = 16, 
      start_intersection = 'Jimma University Specialized Hospital Gate', 
      end_intersection = 'Pharmacy Row',
      lanes = 2,
      has_sidewalk = true,
      has_street_lights = true,
      has_drainage = true
    WHERE id = 4;

    UPDATE streets SET 
      width_meters = 24, 
      start_intersection = 'Main Campus Main Gate', 
      end_intersection = 'Technology Institute Junction',
      lanes = 4,
      has_sidewalk = true,
      has_street_lights = true,
      has_drainage = true
    WHERE id = 5;

    UPDATE streets SET 
      width_meters = 18, 
      start_intersection = 'Palace East Gate', 
      end_intersection = 'Ajora Kebele Office',
      lanes = 2,
      has_sidewalk = true,
      has_street_lights = true,
      has_drainage = true
    WHERE id = 6;
  `);
  console.log('Backfilled road inventory attributes for existing streets.');

  const res = await client.query(`
    SELECT id, name, code, length_meters, width_meters, condition, start_intersection, end_intersection, has_drainage, has_street_lights
    FROM streets ORDER BY id;
  `);
  console.table(res.rows);

  await client.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

const pg = require('pg');

async function migrate() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected to Neon PostgreSQL database.');

  // 1. Add columns if they do not already exist
  await client.query(`
    ALTER TABLE streets 
    ADD COLUMN IF NOT EXISTS length_meters REAL;
  `);

  await client.query(`
    ALTER TABLE streets 
    ADD COLUMN IF NOT EXISTS condition TEXT NOT NULL DEFAULT 'good';
  `);
  console.log('Added length_meters and condition columns to streets table.');

  // 2. Update existing rows with realistic sample values and GPS coordinates
  await client.query(`
    UPDATE streets 
    SET length_meters = 1450, 
        condition = 'good', 
        start_lat = 7.6710, start_lng = 36.8310, 
        end_lat = 7.6820, end_lng = 36.8390 
    WHERE id = 1;
  `);

  await client.query(`
    UPDATE streets 
    SET length_meters = 820, 
        condition = 'fair', 
        start_lat = 7.6650, start_lng = 36.8280, 
        end_lat = 7.6710, end_lng = 36.8330 
    WHERE id = 2;
  `);

  await client.query(`
    UPDATE streets 
    SET length_meters = 450, 
        condition = 'poor', 
        start_lat = 7.6620, start_lng = 36.8340, 
        end_lat = 7.6650, end_lng = 36.8370 
    WHERE id = 3;
  `);

  await client.query(`
    UPDATE streets 
    SET length_meters = 1100, 
        condition = 'good', 
        start_lat = 7.6730, start_lng = 36.8400, 
        end_lat = 7.6810, end_lng = 36.8450 
    WHERE id = 4;
  `);

  await client.query(`
    UPDATE streets 
    SET length_meters = 2300, 
        condition = 'under_maintenance', 
        start_lat = 7.6780, start_lng = 36.8420, 
        end_lat = 7.6950, end_lng = 36.8520 
    WHERE id = 5;
  `);
  console.log('Existing streets updated with sample lengths, conditions, and GPS coordinates.');

  // 3. Verify
  const res = await client.query(`
    SELECT id, name, code, length_meters, condition, start_lat, start_lng, end_lat, end_lng 
    FROM streets 
    ORDER BY id;
  `);
  console.log('Current streets in database:');
  console.table(res.rows);

  await client.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

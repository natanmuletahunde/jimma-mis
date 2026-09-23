const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
async function run() {
  await pool.query(`
    UPDATE streets SET road_surface = 'Asphalt', street_type = 'Arterial Road' WHERE code = 'BONGA';
    UPDATE streets SET road_surface = 'Cobblestone', street_type = 'Collector Street' WHERE code = 'STADM';
    UPDATE streets SET road_surface = 'Cobblestone', street_type = 'Local Street' WHERE code = 'MKTLN';
    UPDATE streets SET road_surface = 'Asphalt', street_type = 'Avenue' WHERE code = 'HOSAV';
    UPDATE streets SET road_surface = 'Asphalt', street_type = 'Boulevard' WHERE code = 'UNIRD';
  `);
  console.log("Street surfaces updated successfully.");
  await pool.end();
}
run();

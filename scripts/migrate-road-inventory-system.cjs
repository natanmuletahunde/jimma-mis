const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log("Connecting to PostgreSQL...");
  const client = await pool.connect();
  try {
    console.log("Altering 'streets' table to add PCI and lifecycle fields...");
    await client.query(`
      ALTER TABLE streets
        ADD COLUMN IF NOT EXISTS last_resurfaced_year INTEGER,
        ADD COLUMN IF NOT EXISTS last_pci_score INTEGER,
        ADD COLUMN IF NOT EXISTS last_pci_rating TEXT,
        ADD COLUMN IF NOT EXISTS next_inspection_date TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS maintenance_priority TEXT NOT NULL DEFAULT 'routine';
    `);

    console.log("Creating 'road_maintenance_records' table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS road_maintenance_records (
        id SERIAL PRIMARY KEY,
        street_id INTEGER NOT NULL REFERENCES streets(id) ON DELETE CASCADE,
        activity_type TEXT NOT NULL,
        pci_score INTEGER,
        pci_rating TEXT,
        distress_types TEXT,
        performed_date TIMESTAMPTZ NOT NULL,
        contractor TEXT,
        cost_etb REAL,
        funding_source TEXT,
        next_inspection_due TIMESTAMPTZ,
        status TEXT NOT NULL DEFAULT 'completed',
        inspector_name TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_road_maint_street_id ON road_maintenance_records(street_id);
      CREATE INDEX IF NOT EXISTS idx_road_maint_performed_date ON road_maintenance_records(performed_date);
    `);

    console.log("Updating existing streets with baseline PCI and maintenance priority...");
    // Bonga Road
    await client.query(`
      UPDATE streets
      SET 
        last_resurfaced_year = 2023,
        last_pci_score = 88,
        last_pci_rating = 'good',
        next_inspection_date = NOW() + INTERVAL '180 days',
        maintenance_priority = 'routine'
      WHERE code = 'BONGA';
    `);

    // Stadium Street
    await client.query(`
      UPDATE streets
      SET 
        last_resurfaced_year = 2021,
        last_pci_score = 65,
        last_pci_rating = 'fair',
        next_inspection_date = NOW() + INTERVAL '45 days',
        maintenance_priority = 'medium'
      WHERE code = 'STADM';
    `);

    // Market Lane
    await client.query(`
      UPDATE streets
      SET 
        last_resurfaced_year = 2018,
        last_pci_score = 42,
        last_pci_rating = 'poor',
        next_inspection_date = NOW() + INTERVAL '14 days',
        maintenance_priority = 'high'
      WHERE code = 'MKTLN';
    `);

    // Hospital Avenue
    await client.query(`
      UPDATE streets
      SET 
        last_resurfaced_year = 2024,
        last_pci_score = 92,
        last_pci_rating = 'good',
        next_inspection_date = NOW() + INTERVAL '300 days',
        maintenance_priority = 'routine'
      WHERE code = 'HOSAV';
    `);

    // University Road
    await client.query(`
      UPDATE streets
      SET 
        last_resurfaced_year = 2017,
        last_pci_score = 35,
        last_pci_rating = 'very_poor',
        next_inspection_date = NOW() + INTERVAL '7 days',
        maintenance_priority = 'critical'
      WHERE code = 'UNIRD';
    `);

    // Aba Jifar Palace Boulevard
    await client.query(`
      UPDATE streets
      SET 
        last_resurfaced_year = 2022,
        last_pci_score = 72,
        last_pci_rating = 'satisfactory',
        next_inspection_date = NOW() + INTERVAL '90 days',
        maintenance_priority = 'routine'
      WHERE code = 'AJPAL';
    `);

    console.log("Seeding sample historical maintenance and inspection records...");
    const { rows: streets } = await client.query(`SELECT id, code FROM streets`);
    const streetMap = {};
    for (const s of streets) streetMap[s.code] = s.id;

    // Check if records already exist
    const { rows: existingRecords } = await client.query(`SELECT COUNT(*) as count FROM road_maintenance_records`);
    if (parseInt(existingRecords[0].count, 10) === 0) {
      if (streetMap['BONGA']) {
        await client.query(`
          INSERT INTO road_maintenance_records 
            (street_id, activity_type, pci_score, pci_rating, distress_types, performed_date, contractor, cost_etb, funding_source, next_inspection_due, status, inspector_name, notes)
          VALUES 
            ($1, 'resurfacing', 95, 'good', 'None - newly paved asphalt overlay', NOW() - INTERVAL '365 days', 'Sur Construction PLC', 4850000, 'regional_grant', NOW() - INTERVAL '180 days', 'completed', 'Eng. Dawit Bekele', 'Full asphalt binder course and wearing course renewal with thermoplastic markings.'),
            ($1, 'inspection', 88, 'good', 'Minor longitudinal hairline joints', NOW() - INTERVAL '60 days', 'Jimma Municipal Works Bureau', 45000, 'municipal_budget', NOW() + INTERVAL '180 days', 'completed', 'Eng. Abebe Tadesse', 'Routine 6-month post-warranty inspection. Pavement structure in excellent condition.')
        `, [streetMap['BONGA']]);
      }

      if (streetMap['STADM']) {
        await client.query(`
          INSERT INTO road_maintenance_records 
            (street_id, activity_type, pci_score, pci_rating, distress_types, performed_date, contractor, cost_etb, funding_source, next_inspection_due, status, inspector_name, notes)
          VALUES 
            ($1, 'pothole_patching', 68, 'fair', 'Isolated localized potholing near stadium east gate', NOW() - INTERVAL '90 days', 'Jimma Municipal Works Bureau', 240000, 'municipal_budget', NOW() + INTERVAL '45 days', 'completed', 'Ins. Tigist Mengistu', 'Cold-mix asphalt patching of 14 localized potholes before sports championship.')
        `, [streetMap['STADM']]);
      }

      if (streetMap['MKTLN']) {
        await client.query(`
          INSERT INTO road_maintenance_records 
            (street_id, activity_type, pci_score, pci_rating, distress_types, performed_date, contractor, cost_etb, funding_source, next_inspection_due, status, inspector_name, notes)
          VALUES 
            ($1, 'inspection', 42, 'poor', 'Severe alligator cracking, edge ravelling, gutter siltation', NOW() - INTERVAL '30 days', 'Jimma Infrastructure Dept', 25000, 'municipal_budget', NOW() + INTERVAL '14 days', 'completed', 'Eng. Abebe Tadesse', 'Pavement serviceability severely compromised by heavy market cargo truck traffic. Recommended for complete cobblestone or asphalt reconstruction.')
        `, [streetMap['MKTLN']]);
      }

      if (streetMap['UNIRD']) {
        await client.query(`
          INSERT INTO road_maintenance_records 
            (street_id, activity_type, pci_score, pci_rating, distress_types, performed_date, contractor, cost_etb, funding_source, next_inspection_due, status, inspector_name, notes)
          VALUES 
            ($1, 'inspection', 35, 'very_poor', 'Widespread structural fatigue cracking, deep rutting, washed out shoulders', NOW() - INTERVAL '15 days', 'Oromia Roads Authority Joint Inspection', 30000, 'federal_grant', NOW() + INTERVAL '7 days', 'completed', 'Eng. Kifle Gemeda', 'Critical transport artery connecting university campus. Project tender issued for 2026/27 capital budget.')
        `, [streetMap['UNIRD']]);
      }
      console.log("Sample maintenance records seeded successfully.");
    }

    console.log("Migration complete!");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});

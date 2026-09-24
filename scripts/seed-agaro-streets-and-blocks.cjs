// scripts/seed-agaro-streets-and-blocks.cjs
// Seeds streets and blocks for all Agaro City Kebeles (and existing kebeles) with PostGIS geometries

const { Pool } = require('pg');

async function seed() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log("Connecting to database...");

  // 1. Fetch kebeles
  const kebelesRes = await pool.query('SELECT id, name, code FROM kebeles ORDER BY id');
  const kebeles = kebelesRes.rows;
  console.log(`Found ${kebeles.length} kebeles:`, kebeles.map(k => `${k.id}: ${k.name} (${k.code})`).join(', '));

  const kbMap = {};
  kebeles.forEach(k => {
    kbMap[k.code] = k.id;
  });

  // 2. Define Agaro Streets
  const streetsData = [
    // Kebele 01 (KB01) - City Center & Administrative
    {
      kebeleCode: 'KB01',
      name: 'Main Hospital Road',
      code: 'HOSPRD',
      streetType: 'Avenue',
      roadSurface: 'Asphalt',
      startLat: 7.8530, startLng: 36.6480,
      endLat: 7.8570, endLng: 36.6520,
      lengthMeters: 1200, widthMeters: 20, lanes: 2,
      hasSidewalk: true, hasStreetLights: true, hasDrainage: true,
      condition: 'good', maintenancePriority: 'routine',
      description: 'Major arterial connecting Agaro Hospital and central administrative zone.',
      blocks: [
        { code: 'BLK-01', description: 'General Hospital & Health Center Zone' },
        { code: 'BLK-02', description: 'Central Commercial Plaza & Pharmacy Block' },
        { code: 'BLK-03', description: 'Residential Quarter Alpha' },
      ]
    },
    {
      kebeleCode: 'KB01',
      name: 'Coffee Board Avenue',
      code: 'COFFRD',
      streetType: 'Boulevard',
      roadSurface: 'Asphalt',
      startLat: 7.8510, startLng: 36.6450,
      endLat: 7.8550, endLng: 36.6500,
      lengthMeters: 1500, widthMeters: 24, lanes: 4,
      hasSidewalk: true, hasStreetLights: true, hasDrainage: true,
      condition: 'good', maintenancePriority: 'routine',
      description: 'Primary commercial boulevard housing the Coffee Board, banks, and major trading houses.',
      blocks: [
        { code: 'BLK-01', description: 'Ethiopian Coffee Exchange & Exporters Hub' },
        { code: 'BLK-02', description: 'Commercial Banks & Financial District' },
        { code: 'BLK-03', description: 'Administrative & Municipal Offices' },
      ]
    },
    {
      kebeleCode: 'KB01',
      name: 'Market Square Avenue',
      code: 'MKTSQ',
      streetType: 'Avenue',
      roadSurface: 'Cobblestone',
      startLat: 7.8540, startLng: 36.6510,
      endLat: 7.8580, endLng: 36.6550,
      lengthMeters: 850, widthMeters: 16, lanes: 2,
      hasSidewalk: true, hasStreetLights: true, hasDrainage: true,
      condition: 'good', maintenancePriority: 'routine',
      description: 'High-density trading corridor surrounding the Central Municipal Market.',
      blocks: [
        { code: 'BLK-01', description: 'Central Market & Grain Trade Zone' },
        { code: 'BLK-02', description: 'Retail Shops & Mixed Commercial Block' },
        { code: 'BLK-03', description: 'Transport Terminal & Bus Station Block' },
      ]
    },
    {
      kebeleCode: 'KB01',
      name: 'Post Office Street',
      code: 'POSTRD',
      streetType: 'Street',
      roadSurface: 'Cobblestone',
      startLat: 7.8520, startLng: 36.6490,
      endLat: 7.8550, endLng: 36.6530,
      lengthMeters: 600, widthMeters: 12, lanes: 2,
      hasSidewalk: true, hasStreetLights: true, hasDrainage: false,
      condition: 'good', maintenancePriority: 'routine',
      description: 'Connecting Ethio Telecom and Postal service to the main avenue.',
      blocks: [
        { code: 'BLK-01', description: 'Post Office & Telecom Center' },
        { code: 'BLK-02', description: 'Government Services & Legal Offices' },
      ]
    },

    // Kebele 02 (KB02) - Educational & Residential
    {
      kebeleCode: 'KB02',
      name: 'Stadium Road',
      code: 'STADRD',
      streetType: 'Avenue',
      roadSurface: 'Asphalt',
      startLat: 7.8600, startLng: 36.6450,
      endLat: 7.8650, endLng: 36.6500,
      lengthMeters: 1100, widthMeters: 18, lanes: 2,
      hasSidewalk: true, hasStreetLights: true, hasDrainage: true,
      condition: 'good', maintenancePriority: 'routine',
      description: 'Avenue leading to Agaro Municipal Stadium.',
      blocks: [
        { code: 'BLK-01', description: 'Agaro Municipal Stadium Block' },
        { code: 'BLK-02', description: 'Sports Club & Recreation Block' },
        { code: 'BLK-03', description: 'North Residential Quarter' },
      ]
    },
    {
      kebeleCode: 'KB02',
      name: 'High School Lane',
      code: 'SCHLN',
      streetType: 'Street',
      roadSurface: 'Cobblestone',
      startLat: 7.8580, startLng: 36.6470,
      endLat: 7.8620, endLng: 36.6520,
      lengthMeters: 750, widthMeters: 14, lanes: 2,
      hasSidewalk: true, hasStreetLights: false, hasDrainage: true,
      condition: 'good', maintenancePriority: 'routine',
      description: 'Access street for Agaro Secondary Comprehensive School.',
      blocks: [
        { code: 'BLK-01', description: 'Agaro Secondary School Campus' },
        { code: 'BLK-02', description: 'Teachers Quarters & Residential Area' },
      ]
    },
    {
      kebeleCode: 'KB02',
      name: 'Green Park Avenue',
      code: 'PRKAV',
      streetType: 'Avenue',
      roadSurface: 'Asphalt',
      startLat: 7.8610, startLng: 36.6490,
      endLat: 7.8660, endLng: 36.6540,
      lengthMeters: 900, widthMeters: 16, lanes: 2,
      hasSidewalk: true, hasStreetLights: true, hasDrainage: true,
      condition: 'good', maintenancePriority: 'routine',
      description: 'Scenic residential avenue bordering municipal park.',
      blocks: [
        { code: 'BLK-01', description: 'Public Park & Community Center' },
        { code: 'BLK-02', description: 'Residential Villa Quarter' },
      ]
    },

    // Kebele 03 (KB03) - Industrial & Agro-Processing
    {
      kebeleCode: 'KB03',
      name: 'Industrial Road',
      code: 'INDRD',
      streetType: 'Avenue',
      roadSurface: 'Asphalt',
      startLat: 7.8450, startLng: 36.6400,
      endLat: 7.8500, endLng: 36.6460,
      lengthMeters: 1400, widthMeters: 22, lanes: 2,
      hasSidewalk: false, hasStreetLights: true, hasDrainage: true,
      condition: 'good', maintenancePriority: 'routine',
      description: 'Industrial heavy corridor for coffee washing stations and warehouses.',
      blocks: [
        { code: 'BLK-01', description: 'Coffee Processing Mills & Warehouses' },
        { code: 'BLK-02', description: 'Light Manufacturing & Grain Storage' },
      ]
    },
    {
      kebeleCode: 'KB03',
      name: 'Ring Road South',
      code: 'RNGSTH',
      streetType: 'Highway',
      roadSurface: 'Asphalt',
      startLat: 7.8420, startLng: 36.6380,
      endLat: 7.8480, endLng: 36.6450,
      lengthMeters: 1800, widthMeters: 24, lanes: 4,
      hasSidewalk: true, hasStreetLights: true, hasDrainage: true,
      condition: 'good', maintenancePriority: 'routine',
      description: 'Southern bypass highway for long-haul trucks and freight transport.',
      blocks: [
        { code: 'BLK-01', description: 'Freight Transport Logistics Hub' },
        { code: 'BLK-02', description: 'Heavy Machinery & Auto Workshop Zone' },
      ]
    },

    // Kebele 04 (KB04) - Eastern Residential
    {
      kebeleCode: 'KB04',
      name: 'Sunrise Boulevard',
      code: 'SUNBLV',
      streetType: 'Boulevard',
      roadSurface: 'Cobblestone',
      startLat: 7.8550, startLng: 36.6580,
      endLat: 7.8600, endLng: 36.6630,
      lengthMeters: 1000, widthMeters: 16, lanes: 2,
      hasSidewalk: true, hasStreetLights: true, hasDrainage: true,
      condition: 'good', maintenancePriority: 'routine',
      description: 'Eastern residential expansion corridor.',
      blocks: [
        { code: 'BLK-01', description: 'Sunrise Residential Quarter' },
        { code: 'BLK-02', description: 'Neighborhood Commercial Center' },
      ]
    },
    {
      kebeleCode: 'KB04',
      name: 'Hill View Way',
      code: 'HLVIEW',
      streetType: 'Street',
      roadSurface: 'Gravel',
      startLat: 7.8580, startLng: 36.6600,
      endLat: 7.8630, endLng: 36.6650,
      lengthMeters: 800, widthMeters: 12, lanes: 2,
      hasSidewalk: false, hasStreetLights: false, hasDrainage: false,
      condition: 'fair', maintenancePriority: 'routine',
      description: 'Residential hillside community access.',
      blocks: [
        { code: 'BLK-01', description: 'Highland Residential Block' },
        { code: 'BLK-02', description: 'Agricultural Extension & Nursery' },
      ]
    },

    // Kebele 05 (KB05) - Western Expansion & Higher Education
    {
      kebeleCode: 'KB05',
      name: 'University Branch Way',
      code: 'UNIBR',
      streetType: 'Avenue',
      roadSurface: 'Asphalt',
      startLat: 7.8480, startLng: 36.6320,
      endLat: 7.8530, endLng: 36.6380,
      lengthMeters: 1300, widthMeters: 20, lanes: 2,
      hasSidewalk: true, hasStreetLights: true, hasDrainage: true,
      condition: 'good', maintenancePriority: 'routine',
      description: 'Access corridor for Jimma University Agaro Campus extension.',
      blocks: [
        { code: 'BLK-01', description: 'Higher Education & Research Campus' },
        { code: 'BLK-02', description: 'Student Housing & Faculty Residences' },
      ]
    },
    {
      kebeleCode: 'KB05',
      name: 'Eco Park Road',
      code: 'ECOPRK',
      streetType: 'Street',
      roadSurface: 'Cobblestone',
      startLat: 7.8500, startLng: 36.6350,
      endLat: 7.8540, endLng: 36.6400,
      lengthMeters: 700, widthMeters: 14, lanes: 2,
      hasSidewalk: true, hasStreetLights: true, hasDrainage: false,
      condition: 'good', maintenancePriority: 'routine',
      description: 'Access street for eco-corridor and residential development.',
      blocks: [
        { code: 'BLK-01', description: 'Eco-Tourism & Botanical Gardens' },
        { code: 'BLK-02', description: 'Green Belt Residential Block' },
      ]
    },
  ];

  // 3. Insert Agaro Streets & Blocks
  console.log("\n--- Seeding Agaro Streets and Blocks ---");
  for (const s of streetsData) {
    const kebeleId = kbMap[s.kebeleCode];
    if (!kebeleId) {
      console.warn(`Warning: Kebele code ${s.kebeleCode} not found in database! Skipping street ${s.name}`);
      continue;
    }

    // Check if street already exists
    let streetId;
    const existing = await pool.query('SELECT id FROM streets WHERE code = $1 OR (name = $2 AND kebele_id = $3)', [s.code, s.name, kebeleId]);
    if (existing.rows.length > 0) {
      streetId = existing.rows[0].id;
      console.log(`Street "${s.name}" already exists (ID: ${streetId})`);
    } else {
      const insRes = await pool.query(`
        INSERT INTO streets (
          name, code, kebele_id, street_type, road_surface,
          start_lat, start_lng, end_lat, end_lng,
          length_meters, width_meters, lanes,
          has_sidewalk, has_street_lights, has_drainage,
          condition, maintenance_priority, description, status
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12,
          $13, $14, $15,
          $16, $17, $18, 'active'
        ) RETURNING id
      `, [
        s.name, s.code, kebeleId, s.streetType, s.roadSurface,
        s.startLat, s.startLng, s.endLat, s.endLng,
        s.lengthMeters, s.widthMeters, s.lanes,
        s.hasSidewalk, s.hasStreetLights, s.hasDrainage,
        s.condition, s.maintenancePriority, s.description
      ]);
      streetId = insRes.rows[0].id;
      console.log(`✓ Inserted Street "${s.name}" (ID: ${streetId}) in Kebele ${s.kebeleCode}`);
    }

    // Insert Blocks for this street
    for (const b of s.blocks) {
      const existingBlock = await pool.query('SELECT id FROM blocks WHERE code = $1 AND street_id = $2', [b.code, streetId]);
      if (existingBlock.rows.length === 0) {
        await pool.query(`
          INSERT INTO blocks (code, kebele_id, street_id, description, status)
          VALUES ($1, $2, $3, $4, 'active')
        `, [b.code, kebeleId, streetId, b.description]);
        console.log(`  + Block ${b.code} (${b.description}) added to street ${s.name}`);
      }
    }
  }

  // 4. Also add default blocks to any existing Jimma streets (id 1..3) that have no blocks
  console.log("\n--- Checking existing streets for missing blocks ---");
  const allStreets = await pool.query('SELECT id, name, kebele_id FROM streets ORDER BY id');
  for (const st of allStreets.rows) {
    const bCheck = await pool.query('SELECT count(*) FROM blocks WHERE street_id = $1', [st.id]);
    if (parseInt(bCheck.rows[0].count, 10) === 0) {
      console.log(`Adding default blocks for street "${st.name}" (ID: ${st.id})...`);
      await pool.query(`
        INSERT INTO blocks (code, kebele_id, street_id, description, status)
        VALUES 
          ('BLK-01', $1, $2, 'Primary Sector Block A', 'active'),
          ('BLK-02', $1, $2, 'Secondary Sector Block B', 'active')
      `, [st.kebele_id, st.id]);
      console.log(`  + Blocks BLK-01, BLK-02 added to street "${st.name}"`);
    }
  }

  // 5. Update users so enumerators and kebele officers can access all kebeles in Agaro
  console.log("\n--- Updating user permissions for testing flexibility ---");
  await pool.query(`
    UPDATE users 
    SET kebele_id = NULL 
    WHERE username IN ('enumerator1', 'enumerator@jimma.gov.et', 'kebele_officer1', 'kebeleofficer@jimma.gov.et')
  `);
  console.log("✓ Set kebele_id = NULL for test enumerators and kebele officers (full municipal access)");

  // 6. Ensure PostGIS geometries are synchronized on all streets
  console.log("\n--- Verifying PostGIS Geometries for Streets ---");
  await pool.query(`
    UPDATE streets
    SET geom = ST_SetSRID(ST_MakeLine(ST_MakePoint(start_lng, start_lat), ST_MakePoint(end_lng, end_lat)), 4326)
    WHERE start_lat IS NOT NULL AND start_lng IS NOT NULL 
      AND end_lat IS NOT NULL AND end_lng IS NOT NULL
      AND geom IS NULL;
  `);

  const geomCount = await pool.query('SELECT count(*) FROM streets WHERE geom IS NOT NULL');
  console.log(`✓ Streets with valid PostGIS LineString geometry: ${geomCount.rows[0].count}`);

  const totalStreets = await pool.query('SELECT count(*) FROM streets');
  const totalBlocks = await pool.query('SELECT count(*) FROM blocks');
  console.log(`\n🎉 Seed Complete! Total Streets: ${totalStreets.rows[0].count}, Total Blocks: ${totalBlocks.rows[0].count}`);

  await pool.end();
}

seed().catch(err => {
  console.error("Seed error:", err);
  process.exit(1);
});

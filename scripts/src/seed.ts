import bcrypt from "bcryptjs";
import { db, pool, kebelesTable, streetsTable, usersTable, propertiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const PASSWORD_HASH = await bcrypt.hash("Password@123", 10);

console.log("Seeding database...");

// ─── Kebeles ───────────────────────────────────────────────────────────────

const kebeleRows = await db
  .insert(kebelesTable)
  .values([
    { name: "Ajora", code: "AJR", district: "Jimma" },
    { name: "Bacho", code: "BCH", district: "Jimma" },
    { name: "Feres Megala", code: "FMG", district: "Jimma" },
  ])
  .onConflictDoNothing()
  .returning();

const kebeles =
  kebeleRows.length > 0
    ? kebeleRows
    : await db.select().from(kebelesTable).limit(3);

console.log(`  ${kebeles.length} kebeles ready`);

// ─── Streets ───────────────────────────────────────────────────────────────

await db
  .insert(streetsTable)
  .values([
    { name: "Bonga Road",       code: "BONGA",  kebeleId: kebeles[0]!.id },
    { name: "Stadium Street",   code: "STADM",  kebeleId: kebeles[0]!.id },
    { name: "Market Lane",      code: "MKTLN",  kebeleId: kebeles[1]!.id },
    { name: "Hospital Avenue",  code: "HOSAV",  kebeleId: kebeles[1]!.id },
    { name: "University Road",  code: "UNIRD",  kebeleId: kebeles[2]!.id },
  ])
  .onConflictDoNothing();

console.log("  5 streets ready");

// ─── Users ─────────────────────────────────────────────────────────────────

const userData = [
  {
    username: "admin@jimma.gov.et",
    email: "admin@jimma.gov.et",
    fullName: "System Administrator",
    role: "admin",
    kebeleId: null,
  },
  {
    username: "cityofficer@jimma.gov.et",
    email: "cityofficer@jimma.gov.et",
    fullName: "City Officer",
    role: "city_officer",
    kebeleId: null,
  },
  {
    username: "kebeleofficer@jimma.gov.et",
    email: "kebeleofficer@jimma.gov.et",
    fullName: "Kebele Officer",
    role: "kebele_officer",
    kebeleId: kebeles[0]!.id,
  },
  {
    username: "enumerator@jimma.gov.et",
    email: "enumerator@jimma.gov.et",
    fullName: "Field Enumerator",
    role: "enumerator",
    kebeleId: kebeles[0]!.id,
  },
  {
    username: "viewer@jimma.gov.et",
    email: "viewer@jimma.gov.et",
    fullName: "Read-Only Viewer",
    role: "viewer",
    kebeleId: null,
  },
];

for (const u of userData) {
  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, u.username));

  if (existing.length === 0) {
    await db.insert(usersTable).values({ ...u, passwordHash: PASSWORD_HASH });
    console.log(`  Created user: ${u.username} (${u.role})`);
  } else {
    await db
      .update(usersTable)
      .set({ passwordHash: PASSWORD_HASH, email: u.email, role: u.role })
      .where(eq(usersTable.username, u.username));
    console.log(`  Updated user: ${u.username} (${u.role})`);
  }
}

// ─── Sample Properties ─────────────────────────────────────────────────────

const [adminUser] = await db
  .select({ id: usersTable.id })
  .from(usersTable)
  .where(eq(usersTable.username, "admin@jimma.gov.et"));

const enumUser = await db
  .select({ id: usersTable.id })
  .from(usersTable)
  .where(eq(usersTable.username, "enumerator@jimma.gov.et"));
const enumId = enumUser[0]?.id ?? adminUser?.id;

const sampleProperties = [
  {
    ownerName: "Abebe Girma",
    propertyType: "residential",
    ownershipType: "private",
    kebele: "AJR",
    streetName: "Bonga Road",
    blockCode: "BL01",
    houseNumber: "101",
    numberOfFloors: 1,
    status: "approved",
    addressCode: "JIM-KBAJR-STBONGA-BL01-HN101",
    latitude: 7.6742,
    longitude: 36.8334,
    createdBy: enumId,
  },
  {
    ownerName: "Tigist Haile",
    propertyType: "commercial",
    ownershipType: "private",
    kebele: "AJR",
    streetName: "Stadium Street",
    blockCode: "BL02",
    houseNumber: "202",
    businessName: "Tigist General Trading",
    numberOfFloors: 2,
    status: "pending",
    latitude: 7.6751,
    longitude: 36.8345,
    createdBy: enumId,
  },
  {
    ownerName: "Jimma City Administration",
    propertyType: "government",
    ownershipType: "government",
    kebele: "BCH",
    streetName: "Market Lane",
    blockCode: "BL01",
    houseNumber: "001",
    buildingName: "City Hall",
    numberOfFloors: 3,
    status: "approved",
    addressCode: "JIM-KBBCH-STMKTLN-BL01-HN001",
    latitude: 7.6715,
    longitude: 36.8290,
    createdBy: adminUser?.id,
  },
  {
    ownerName: "Selam Tadesse",
    propertyType: "residential",
    ownershipType: "private",
    kebele: "BCH",
    streetName: "Hospital Avenue",
    blockCode: "BL03",
    houseNumber: "314",
    numberOfFloors: 1,
    status: "kebele_verified",
    latitude: 7.6730,
    longitude: 36.8310,
    createdBy: enumId,
  },
  {
    ownerName: "Jimma University",
    propertyType: "institution",
    ownershipType: "institutional",
    kebele: "FMG",
    streetName: "University Road",
    blockCode: "BL01",
    houseNumber: "001",
    buildingName: "Main Campus",
    numberOfFloors: 4,
    status: "approved",
    addressCode: "JIM-KBFMG-STUNIRD-BL01-HN001",
    latitude: 7.6680,
    longitude: 36.8260,
    createdBy: adminUser?.id,
  },
  {
    ownerName: "Mohammed Seid",
    propertyType: "commercial",
    ownershipType: "private",
    kebele: "AJR",
    streetName: "Bonga Road",
    blockCode: "BL01",
    houseNumber: "105",
    businessName: "Seid Mini Market",
    numberOfFloors: 1,
    status: "rejected",
    remark: "Missing GPS coordinates. Please re-submit with location data.",
    createdBy: enumId,
  },
  {
    ownerName: "Hana Bekele",
    propertyType: "residential",
    ownershipType: "private",
    kebele: "FMG",
    streetName: "University Road",
    blockCode: "BL02",
    houseNumber: "210",
    numberOfFloors: 2,
    status: "pending",
    latitude: 7.6695,
    longitude: 36.8270,
    createdBy: enumId,
  },
  {
    ownerName: "Dereje Wolde",
    propertyType: "mixed",
    ownershipType: "private",
    kebele: "BCH",
    streetName: "Market Lane",
    blockCode: "BL02",
    houseNumber: "225",
    numberOfFloors: 3,
    status: "kebele_verified",
    buildingUse: "Ground floor commercial, upper floors residential",
    latitude: 7.6720,
    longitude: 36.8295,
    createdBy: enumId,
  },
  {
    ownerName: "Fatuma Ali",
    propertyType: "residential",
    ownershipType: "private",
    kebele: "AJR",
    streetName: "Stadium Street",
    blockCode: "BL02",
    houseNumber: "208",
    numberOfFloors: 1,
    status: "approved",
    addressCode: "JIM-KBAJR-STST-BL02-HN208",
    latitude: 7.6760,
    longitude: 36.8355,
    createdBy: enumId,
  },
  {
    ownerName: "Yonas Tesfaye",
    propertyType: "residential",
    ownershipType: "private",
    kebele: "FMG",
    streetName: "University Road",
    blockCode: "BL03",
    houseNumber: "301",
    numberOfFloors: 1,
    status: "pending",
    latitude: 7.6700,
    longitude: 36.8280,
    createdBy: enumId,
  },
];

let inserted = 0;
let skipped = 0;
for (const prop of sampleProperties) {
  const existing = await db
    .select({ id: propertiesTable.id })
    .from(propertiesTable)
    .where(eq(propertiesTable.houseNumber, prop.houseNumber ?? ""))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(propertiesTable).values(prop);
    inserted++;
  } else {
    skipped++;
  }
}
console.log(`  ${inserted} properties inserted, ${skipped} already existed`);

await pool.end();
console.log("\nSeed complete.");

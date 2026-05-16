import { Router } from "express";
import { db, kebelesTable, streetsTable, blocksTable, propertiesTable } from "@workspace/db";
import { writeAudit as _audit } from "../lib/audit";
import { eq, and, ilike, ne, or } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function writeAudit(actorId: number, action: string, entityType: string, entityId: number, details: string) {
  await _audit({ userId: actorId, action, entityType, entityId, details });
}

function parseId(raw: string | string[]): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(s, 10);
}

type KebeleRow = typeof kebelesTable.$inferSelect;
type StreetRow = typeof streetsTable.$inferSelect;
type BlockRow = typeof blocksTable.$inferSelect;

async function formatKebele(k: KebeleRow) {
  return {
    id: k.id,
    name: k.name,
    code: k.code,
    city: k.city,
    subCity: k.subCity ?? null,
    woreda: k.woreda ?? null,
    district: k.district ?? null,
    status: k.status,
    createdAt: k.createdAt.toISOString(),
    updatedAt: k.updatedAt.toISOString(),
  };
}

async function formatStreet(s: StreetRow) {
  let kebeleName: string | null = null;
  if (s.kebeleId) {
    const [k] = await db.select({ name: kebelesTable.name }).from(kebelesTable).where(eq(kebelesTable.id, s.kebeleId)).limit(1);
    kebeleName = k?.name ?? null;
  }
  return {
    id: s.id,
    name: s.name,
    code: s.code,
    kebeleId: s.kebeleId,
    kebeleName,
    streetType: s.streetType ?? null,
    roadSurface: s.roadSurface ?? null,
    startLat: s.startLat ?? null,
    startLng: s.startLng ?? null,
    endLat: s.endLat ?? null,
    endLng: s.endLng ?? null,
    description: s.description ?? null,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

async function formatBlock(b: BlockRow) {
  let kebeleName: string | null = null;
  let streetName: string | null = null;
  let streetCode: string | null = null;
  if (b.kebeleId) {
    const [k] = await db.select({ name: kebelesTable.name }).from(kebelesTable).where(eq(kebelesTable.id, b.kebeleId)).limit(1);
    kebeleName = k?.name ?? null;
  }
  if (b.streetId) {
    const [s] = await db.select({ name: streetsTable.name, code: streetsTable.code }).from(streetsTable).where(eq(streetsTable.id, b.streetId)).limit(1);
    streetName = s?.name ?? null;
    streetCode = s?.code ?? null;
  }
  return {
    id: b.id,
    code: b.code,
    kebeleId: b.kebeleId,
    kebeleName,
    streetId: b.streetId,
    streetName,
    streetCode,
    description: b.description ?? null,
    status: b.status,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

// ─── KEBELE ROUTES ────────────────────────────────────────────────────────────

// GET /kebeles
router.get("/kebeles", requireAuth, async (req, res): Promise<void> => {
  const { status, search } = req.query as Record<string, string>;
  const user = req.user!;

  let rows = await db.select().from(kebelesTable).orderBy(kebelesTable.name);

  // Kebele officers and enumerators only see their own kebele (active)
  if (user.role === "kebele_officer" || user.role === "enumerator") {
    rows = rows.filter((k) => k.status === "active" && (user.kebeleId == null || k.id === user.kebeleId));
  } else {
    if (status) rows = rows.filter((k) => k.status === status);
  }

  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter((k) => k.name.toLowerCase().includes(q) || k.code.toLowerCase().includes(q));
  }

  res.json(await Promise.all(rows.map(formatKebele)));
});

// POST /kebeles
router.post("/kebeles", requireAuth, requireRole("admin", "city_officer"), async (req, res): Promise<void> => {
  const { name, code, city, subCity, woreda, district, status } = req.body as {
    name: string; code: string; city?: string; subCity?: string;
    woreda?: string; district?: string; status?: string;
  };

  if (!name?.trim() || !code?.trim()) {
    res.status(400).json({ error: "name and code are required" }); return;
  }

  const [existing] = await db.select({ id: kebelesTable.id }).from(kebelesTable).where(eq(kebelesTable.code, code.trim().toUpperCase()));
  if (existing) { res.status(409).json({ error: "Kebele code already exists" }); return; }

  const [created] = await db.insert(kebelesTable).values({
    name: name.trim(),
    code: code.trim().toUpperCase(),
    city: city?.trim() || "Jimma",
    subCity: subCity?.trim() || null,
    woreda: woreda?.trim() || null,
    district: district?.trim() || null,
    status: status || "active",
  }).returning();

  await writeAudit(req.user!.userId, "create_kebele", "kebele", created.id, `Created kebele ${created.name} (${created.code})`);
  res.status(201).json(await formatKebele(created));
});

// PUT /kebeles/:id
router.put("/kebeles/:id", requireAuth, requireRole("admin", "city_officer"), async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [existing] = await db.select().from(kebelesTable).where(eq(kebelesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Kebele not found" }); return; }

  const { name, code, city, subCity, woreda, district, status } = req.body as {
    name?: string; code?: string; city?: string; subCity?: string;
    woreda?: string; district?: string; status?: string;
  };

  const newCode = (code?.trim() || existing.code).toUpperCase();
  if (newCode !== existing.code) {
    const [dup] = await db.select({ id: kebelesTable.id }).from(kebelesTable)
      .where(and(eq(kebelesTable.code, newCode), ne(kebelesTable.id, id)));
    if (dup) { res.status(409).json({ error: "Kebele code already exists" }); return; }
  }

  const [updated] = await db.update(kebelesTable).set({
    name: name?.trim() || existing.name,
    code: newCode,
    city: city?.trim() || existing.city,
    subCity: subCity !== undefined ? subCity?.trim() || null : existing.subCity,
    woreda: woreda !== undefined ? woreda?.trim() || null : existing.woreda,
    district: district !== undefined ? district?.trim() || null : existing.district,
    status: status || existing.status,
  }).where(eq(kebelesTable.id, id)).returning();

  await writeAudit(req.user!.userId, "update_kebele", "kebele", id, `Updated kebele ${updated.name}`);
  res.json(await formatKebele(updated));
});

// DELETE /kebeles/:id
router.delete("/kebeles/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [existing] = await db.select().from(kebelesTable).where(eq(kebelesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Kebele not found" }); return; }

  const [streetInUse] = await db.select({ id: streetsTable.id }).from(streetsTable).where(eq(streetsTable.kebeleId, id)).limit(1);
  if (streetInUse) { res.status(400).json({ error: "Cannot delete: this kebele still has streets. Remove all streets first." }); return; }

  const [inUse] = await db.select({ id: propertiesTable.id }).from(propertiesTable)
    .where(or(eq(propertiesTable.kebele, existing.code), eq(propertiesTable.kebele, existing.name))).limit(1);
  if (inUse) { res.status(400).json({ error: "Cannot delete: this kebele is referenced by existing properties." }); return; }

  await db.delete(kebelesTable).where(eq(kebelesTable.id, id));
  await writeAudit(req.user!.userId, "delete_kebele", "kebele", id, `Deleted kebele ${existing.name} (${existing.code})`);
  res.status(204).send();
});

// ─── STREET ROUTES ────────────────────────────────────────────────────────────

// GET /streets
router.get("/streets", requireAuth, async (req, res): Promise<void> => {
  const { kebele_id, status, search } = req.query as Record<string, string>;
  const user = req.user!;

  let rows = await db.select().from(streetsTable).orderBy(streetsTable.name);

  if (user.role === "kebele_officer" || user.role === "enumerator") {
    rows = rows.filter((s) => s.status === "active" && (user.kebeleId == null || s.kebeleId === user.kebeleId));
  } else {
    if (kebele_id) rows = rows.filter((s) => s.kebeleId === parseInt(kebele_id, 10));
    if (status) rows = rows.filter((s) => s.status === status);
  }

  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));
  }

  res.json(await Promise.all(rows.map(formatStreet)));
});

// POST /streets
router.post("/streets", requireAuth, requireRole("admin", "city_officer"), async (req, res): Promise<void> => {
  const { name, code, kebeleId, streetType, roadSurface, startLat, startLng, endLat, endLng, description, status } = req.body as {
    name: string; code: string; kebeleId: number; streetType?: string; roadSurface?: string;
    startLat?: number | null; startLng?: number | null; endLat?: number | null; endLng?: number | null;
    description?: string; status?: string;
  };

  if (!name?.trim() || !code?.trim() || !kebeleId) {
    res.status(400).json({ error: "name, code and kebeleId are required" }); return;
  }

  const [kebele] = await db.select().from(kebelesTable).where(eq(kebelesTable.id, kebeleId));
  if (!kebele) { res.status(400).json({ error: "Kebele not found" }); return; }

  const [dup] = await db.select({ id: streetsTable.id }).from(streetsTable)
    .where(and(eq(streetsTable.code, code.trim().toUpperCase()), eq(streetsTable.kebeleId, kebeleId)));
  if (dup) { res.status(409).json({ error: "Street code already exists within this kebele" }); return; }

  const [created] = await db.insert(streetsTable).values({
    name: name.trim(),
    code: code.trim().toUpperCase(),
    kebeleId,
    streetType: streetType?.trim() || null,
    roadSurface: roadSurface?.trim() || null,
    startLat: startLat ?? null,
    startLng: startLng ?? null,
    endLat: endLat ?? null,
    endLng: endLng ?? null,
    description: description?.trim() || null,
    status: status || "active",
  }).returning();

  await writeAudit(req.user!.userId, "create_street", "street", created.id, `Created street ${created.name} (${created.code})`);
  res.status(201).json(await formatStreet(created));
});

// PUT /streets/:id
router.put("/streets/:id", requireAuth, requireRole("admin", "city_officer"), async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [existing] = await db.select().from(streetsTable).where(eq(streetsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Street not found" }); return; }

  const { name, code, kebeleId, streetType, roadSurface, startLat, startLng, endLat, endLng, description, status } = req.body as {
    name?: string; code?: string; kebeleId?: number; streetType?: string; roadSurface?: string;
    startLat?: number | null; startLng?: number | null; endLat?: number | null; endLng?: number | null;
    description?: string; status?: string;
  };

  const newCode = (code?.trim() || existing.code).toUpperCase();
  const newKebeleId = kebeleId ?? existing.kebeleId;

  if (newCode !== existing.code || newKebeleId !== existing.kebeleId) {
    const [dup] = await db.select({ id: streetsTable.id }).from(streetsTable)
      .where(and(eq(streetsTable.code, newCode), eq(streetsTable.kebeleId, newKebeleId), ne(streetsTable.id, id)));
    if (dup) { res.status(409).json({ error: "Street code already exists within this kebele" }); return; }
  }

  const [updated] = await db.update(streetsTable).set({
    name: name?.trim() || existing.name,
    code: newCode,
    kebeleId: newKebeleId,
    streetType: streetType !== undefined ? streetType?.trim() || null : existing.streetType,
    roadSurface: roadSurface !== undefined ? roadSurface?.trim() || null : existing.roadSurface,
    startLat: startLat !== undefined ? startLat : existing.startLat,
    startLng: startLng !== undefined ? startLng : existing.startLng,
    endLat: endLat !== undefined ? endLat : existing.endLat,
    endLng: endLng !== undefined ? endLng : existing.endLng,
    description: description !== undefined ? description?.trim() || null : existing.description,
    status: status || existing.status,
  }).where(eq(streetsTable.id, id)).returning();

  await writeAudit(req.user!.userId, "update_street", "street", id, `Updated street ${updated.name}`);
  res.json(await formatStreet(updated));
});

// DELETE /streets/:id
router.delete("/streets/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [existing] = await db.select().from(streetsTable).where(eq(streetsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Street not found" }); return; }

  const [blockInUse] = await db.select({ id: blocksTable.id }).from(blocksTable).where(eq(blocksTable.streetId, id)).limit(1);
  if (blockInUse) { res.status(400).json({ error: "Cannot delete: this street still has blocks. Remove all blocks first." }); return; }

  const [inUse] = await db.select({ id: propertiesTable.id }).from(propertiesTable)
    .where(or(eq(propertiesTable.streetName, existing.name), eq(propertiesTable.streetName, existing.code))).limit(1);
  if (inUse) { res.status(400).json({ error: "Cannot delete: this street is referenced by existing properties." }); return; }

  await db.delete(streetsTable).where(eq(streetsTable.id, id));
  await writeAudit(req.user!.userId, "delete_street", "street", id, `Deleted street ${existing.name} (${existing.code})`);
  res.status(204).send();
});

// ─── BLOCK ROUTES ─────────────────────────────────────────────────────────────

// GET /blocks
router.get("/blocks", requireAuth, async (req, res): Promise<void> => {
  const { kebele_id, street_id, status, search } = req.query as Record<string, string>;
  const user = req.user!;

  let rows = await db.select().from(blocksTable).orderBy(blocksTable.code);

  if (user.role === "kebele_officer" || user.role === "enumerator") {
    rows = rows.filter((b) => b.status === "active" && (user.kebeleId == null || b.kebeleId === user.kebeleId));
  } else {
    if (kebele_id) rows = rows.filter((b) => b.kebeleId === parseInt(kebele_id, 10));
    if (status) rows = rows.filter((b) => b.status === status);
  }

  if (street_id) rows = rows.filter((b) => b.streetId === parseInt(street_id, 10));

  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter((b) => b.code.toLowerCase().includes(q));
  }

  res.json(await Promise.all(rows.map(formatBlock)));
});

// POST /blocks
router.post("/blocks", requireAuth, requireRole("admin", "city_officer"), async (req, res): Promise<void> => {
  const { code, kebeleId, streetId, description, status } = req.body as {
    code: string; kebeleId: number; streetId: number; description?: string; status?: string;
  };

  if (!code?.trim() || !kebeleId || !streetId) {
    res.status(400).json({ error: "code, kebeleId and streetId are required" }); return;
  }

  const [street] = await db.select().from(streetsTable).where(eq(streetsTable.id, streetId));
  if (!street) { res.status(400).json({ error: "Street not found" }); return; }

  const [dup] = await db.select({ id: blocksTable.id }).from(blocksTable)
    .where(and(eq(blocksTable.code, code.trim().toUpperCase()), eq(blocksTable.streetId, streetId)));
  if (dup) { res.status(409).json({ error: "Block code already exists within this street" }); return; }

  const [created] = await db.insert(blocksTable).values({
    code: code.trim().toUpperCase(),
    kebeleId,
    streetId,
    description: description?.trim() || null,
    status: status || "active",
  }).returning();

  await writeAudit(req.user!.userId, "create_block", "block", created.id, `Created block ${created.code}`);
  res.status(201).json(await formatBlock(created));
});

// PUT /blocks/:id
router.put("/blocks/:id", requireAuth, requireRole("admin", "city_officer"), async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [existing] = await db.select().from(blocksTable).where(eq(blocksTable.id, id));
  if (!existing) { res.status(404).json({ error: "Block not found" }); return; }

  const { code, kebeleId, streetId, description, status } = req.body as {
    code?: string; kebeleId?: number; streetId?: number; description?: string; status?: string;
  };

  const newCode = (code?.trim() || existing.code).toUpperCase();
  const newStreetId = streetId ?? existing.streetId;

  if (newCode !== existing.code || newStreetId !== existing.streetId) {
    const [dup] = await db.select({ id: blocksTable.id }).from(blocksTable)
      .where(and(eq(blocksTable.code, newCode), eq(blocksTable.streetId, newStreetId), ne(blocksTable.id, id)));
    if (dup) { res.status(409).json({ error: "Block code already exists within this street" }); return; }
  }

  const [updated] = await db.update(blocksTable).set({
    code: newCode,
    kebeleId: kebeleId ?? existing.kebeleId,
    streetId: newStreetId,
    description: description !== undefined ? description?.trim() || null : existing.description,
    status: status || existing.status,
  }).where(eq(blocksTable.id, id)).returning();

  await writeAudit(req.user!.userId, "update_block", "block", id, `Updated block ${updated.code}`);
  res.json(await formatBlock(updated));
});

// DELETE /blocks/:id
router.delete("/blocks/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [existing] = await db.select().from(blocksTable).where(eq(blocksTable.id, id));
  if (!existing) { res.status(404).json({ error: "Block not found" }); return; }

  const [inUse] = await db.select({ id: propertiesTable.id }).from(propertiesTable)
    .where(eq(propertiesTable.blockCode, existing.code)).limit(1);
  if (inUse) { res.status(400).json({ error: "Cannot delete: block is referenced by existing properties" }); return; }

  await db.delete(blocksTable).where(eq(blocksTable.id, id));
  await writeAudit(req.user!.userId, "delete_block", "block", id, `Deleted block ${existing.code}`);
  res.status(204).send();
});

export default router;

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

// Single-record formatters — used after INSERT/UPDATE (one record, one extra query is fine).
function formatKebele(k: KebeleRow) {
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

function calculateHaversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

async function formatStreet(s: StreetRow) {
  let kebeleName: string | null = null;
  if (s.kebeleId) {
    const [k] = await db.select({ name: kebelesTable.name }).from(kebelesTable).where(eq(kebelesTable.id, s.kebeleId)).limit(1);
    kebeleName = k?.name ?? null;
  }
  return {
    id: s.id, name: s.name, code: s.code,
    kebeleId: s.kebeleId, kebeleName,
    streetType: s.streetType ?? null, roadSurface: s.roadSurface ?? null,
    startLat: s.startLat ?? null, startLng: s.startLng ?? null,
    endLat: s.endLat ?? null, endLng: s.endLng ?? null,
    lengthMeters: s.lengthMeters ?? null,
    widthMeters: s.widthMeters ?? null,
    condition: s.condition ?? "good",
    startIntersection: s.startIntersection ?? null,
    endIntersection: s.endIntersection ?? null,
    lanes: s.lanes ?? 2,
    hasSidewalk: s.hasSidewalk ?? false,
    hasStreetLights: s.hasStreetLights ?? false,
    hasDrainage: s.hasDrainage ?? false,
    lastResurfacedYear: s.lastResurfacedYear ?? null,
    lastPciScore: s.lastPciScore ?? null,
    lastPciRating: s.lastPciRating ?? null,
    nextInspectionDate: s.nextInspectionDate ? s.nextInspectionDate.toISOString() : null,
    maintenancePriority: s.maintenancePriority ?? "routine",
    description: s.description ?? null, status: s.status,
    createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString(),
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
    id: b.id, code: b.code,
    kebeleId: b.kebeleId, kebeleName,
    streetId: b.streetId, streetName, streetCode,
    description: b.description ?? null, status: b.status,
    createdAt: b.createdAt.toISOString(), updatedAt: b.updatedAt.toISOString(),
  };
}

// ─── KEBELE ROUTES ────────────────────────────────────────────────────────────

// GET /kebeles — DB-level filtering (no in-memory full table scan)
router.get("/kebeles", requireAuth, async (req, res): Promise<void> => {
  const { status, search } = req.query as Record<string, string>;
  const user = req.user!;

  const conditions: ReturnType<typeof eq>[] = [];

  if (user.role === "kebele_officer" || user.role === "enumerator") {
    // Restricted roles: active kebeles only, scoped to their assigned kebele
    conditions.push(eq(kebelesTable.status, "active") as ReturnType<typeof eq>);
    if (user.kebeleId) {
      conditions.push(eq(kebelesTable.id, user.kebeleId) as ReturnType<typeof eq>);
    }
  } else {
    if (status) conditions.push(eq(kebelesTable.status, status) as ReturnType<typeof eq>);
  }

  if (search) {
    conditions.push(
      or(
        ilike(kebelesTable.name, `%${search}%`),
        ilike(kebelesTable.code, `%${search}%`),
      ) as ReturnType<typeof eq>,
    );
  }

  const rows = await db
    .select()
    .from(kebelesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(kebelesTable.name);

  res.json(rows.map(formatKebele));
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
  res.status(201).json(formatKebele(created));
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
  res.json(formatKebele(updated));
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

// GET /streets — single JOIN query; no N+1, no in-memory filtering
router.get("/streets", requireAuth, async (req, res): Promise<void> => {
  const { kebele_id, status, condition, search } = req.query as Record<string, string>;
  const user = req.user!;

  const conditions: ReturnType<typeof eq>[] = [];

  if (user.role === "kebele_officer" || user.role === "enumerator") {
    conditions.push(eq(streetsTable.status, "active") as ReturnType<typeof eq>);
    if (user.kebeleId) {
      conditions.push(eq(streetsTable.kebeleId, user.kebeleId) as ReturnType<typeof eq>);
    }
  } else {
    if (kebele_id) {
      const kid = parseInt(kebele_id, 10);
      if (!isNaN(kid)) conditions.push(eq(streetsTable.kebeleId, kid) as ReturnType<typeof eq>);
    }
    if (status) conditions.push(eq(streetsTable.status, status) as ReturnType<typeof eq>);
  }

  if (condition) {
    conditions.push(eq(streetsTable.condition, condition) as ReturnType<typeof eq>);
  }

  if (search) {
    conditions.push(
      or(
        ilike(streetsTable.name, `%${search}%`),
        ilike(streetsTable.code, `%${search}%`),
      ) as ReturnType<typeof eq>,
    );
  }

  // Single JOIN query — resolves kebele name without N+1
  const rows = await db
    .select({
      id: streetsTable.id,
      name: streetsTable.name,
      code: streetsTable.code,
      kebeleId: streetsTable.kebeleId,
      kebeleName: kebelesTable.name,
      streetType: streetsTable.streetType,
      roadSurface: streetsTable.roadSurface,
      startLat: streetsTable.startLat,
      startLng: streetsTable.startLng,
      endLat: streetsTable.endLat,
      endLng: streetsTable.endLng,
      lengthMeters: streetsTable.lengthMeters,
      widthMeters: streetsTable.widthMeters,
      condition: streetsTable.condition,
      startIntersection: streetsTable.startIntersection,
      endIntersection: streetsTable.endIntersection,
      lanes: streetsTable.lanes,
      hasSidewalk: streetsTable.hasSidewalk,
      hasStreetLights: streetsTable.hasStreetLights,
      hasDrainage: streetsTable.hasDrainage,
      description: streetsTable.description,
      status: streetsTable.status,
      createdAt: streetsTable.createdAt,
      updatedAt: streetsTable.updatedAt,
    })
    .from(streetsTable)
    .leftJoin(kebelesTable, eq(streetsTable.kebeleId, kebelesTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(streetsTable.name);

  res.json(
    rows.map((s) => ({
      id: s.id, name: s.name, code: s.code,
      kebeleId: s.kebeleId, kebeleName: s.kebeleName ?? null,
      streetType: s.streetType ?? null, roadSurface: s.roadSurface ?? null,
      startLat: s.startLat ?? null, startLng: s.startLng ?? null,
      endLat: s.endLat ?? null, endLng: s.endLng ?? null,
      lengthMeters: s.lengthMeters ?? null,
      widthMeters: s.widthMeters ?? null,
      condition: s.condition ?? "good",
      startIntersection: s.startIntersection ?? null,
      endIntersection: s.endIntersection ?? null,
      lanes: s.lanes ?? 2,
      hasSidewalk: s.hasSidewalk ?? false,
      hasStreetLights: s.hasStreetLights ?? false,
      hasDrainage: s.hasDrainage ?? false,
      description: s.description ?? null, status: s.status,
      createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString(),
    })),
  );
});

// POST /streets
router.post("/streets", requireAuth, requireRole("admin", "city_officer"), async (req, res): Promise<void> => {
  const {
    name, code, kebeleId, streetType, roadSurface, startLat, startLng, endLat, endLng,
    lengthMeters, widthMeters, condition, startIntersection, endIntersection, lanes,
    hasSidewalk, hasStreetLights, hasDrainage, description, status,
  } = req.body as {
    name: string; code: string; kebeleId: number; streetType?: string; roadSurface?: string;
    startLat?: number | null; startLng?: number | null; endLat?: number | null; endLng?: number | null;
    lengthMeters?: number | null; widthMeters?: number | null; condition?: string;
    startIntersection?: string; endIntersection?: string; lanes?: number;
    hasSidewalk?: boolean; hasStreetLights?: boolean; hasDrainage?: boolean;
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

  let computedLength = lengthMeters != null ? Number(lengthMeters) : null;
  if ((computedLength == null || isNaN(computedLength)) && startLat != null && startLng != null && endLat != null && endLng != null) {
    computedLength = calculateHaversineDistanceMeters(Number(startLat), Number(startLng), Number(endLat), Number(endLng));
  }

  const [created] = await db.insert(streetsTable).values({
    name: name.trim(), code: code.trim().toUpperCase(), kebeleId,
    streetType: streetType?.trim() || null, roadSurface: roadSurface?.trim() || null,
    startLat: startLat ?? null, startLng: startLng ?? null,
    endLat: endLat ?? null, endLng: endLng ?? null,
    lengthMeters: computedLength != null && !isNaN(computedLength) ? computedLength : null,
    widthMeters: widthMeters != null ? Number(widthMeters) : null,
    condition: condition?.trim() || "good",
    startIntersection: startIntersection?.trim() || null,
    endIntersection: endIntersection?.trim() || null,
    lanes: lanes != null ? Number(lanes) : 2,
    hasSidewalk: Boolean(hasSidewalk),
    hasStreetLights: Boolean(hasStreetLights),
    hasDrainage: Boolean(hasDrainage),
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

  const {
    name, code, kebeleId, streetType, roadSurface, startLat, startLng, endLat, endLng,
    lengthMeters, widthMeters, condition, startIntersection, endIntersection, lanes,
    hasSidewalk, hasStreetLights, hasDrainage, description, status,
  } = req.body as {
    name?: string; code?: string; kebeleId?: number; streetType?: string; roadSurface?: string;
    startLat?: number | null; startLng?: number | null; endLat?: number | null; endLng?: number | null;
    lengthMeters?: number | null; widthMeters?: number | null; condition?: string;
    startIntersection?: string; endIntersection?: string; lanes?: number;
    hasSidewalk?: boolean; hasStreetLights?: boolean; hasDrainage?: boolean;
    description?: string; status?: string;
  };

  const newCode = (code?.trim() || existing.code).toUpperCase();
  const newKebeleId = kebeleId ?? existing.kebeleId;

  if (newCode !== existing.code || newKebeleId !== existing.kebeleId) {
    const [dup] = await db.select({ id: streetsTable.id }).from(streetsTable)
      .where(and(eq(streetsTable.code, newCode), eq(streetsTable.kebeleId, newKebeleId), ne(streetsTable.id, id)));
    if (dup) { res.status(409).json({ error: "Street code already exists within this kebele" }); return; }
  }

  const effectiveStartLat = startLat !== undefined ? startLat : existing.startLat;
  const effectiveStartLng = startLng !== undefined ? startLng : existing.startLng;
  const effectiveEndLat = endLat !== undefined ? endLat : existing.endLat;
  const effectiveEndLng = endLng !== undefined ? endLng : existing.endLng;

  let computedLength: number | null = lengthMeters !== undefined ? (lengthMeters != null ? Number(lengthMeters) : null) : existing.lengthMeters;
  if ((computedLength == null || isNaN(computedLength)) && effectiveStartLat != null && effectiveStartLng != null && effectiveEndLat != null && effectiveEndLng != null) {
    computedLength = calculateHaversineDistanceMeters(Number(effectiveStartLat), Number(effectiveStartLng), Number(effectiveEndLat), Number(effectiveEndLng));
  }

  const [updated] = await db.update(streetsTable).set({
    name: name?.trim() || existing.name, code: newCode, kebeleId: newKebeleId,
    streetType: streetType !== undefined ? streetType?.trim() || null : existing.streetType,
    roadSurface: roadSurface !== undefined ? roadSurface?.trim() || null : existing.roadSurface,
    startLat: effectiveStartLat,
    startLng: effectiveStartLng,
    endLat: effectiveEndLat,
    endLng: effectiveEndLng,
    lengthMeters: computedLength != null && !isNaN(computedLength) ? computedLength : null,
    widthMeters: widthMeters !== undefined ? (widthMeters != null ? Number(widthMeters) : null) : existing.widthMeters,
    condition: condition !== undefined ? condition?.trim() || "good" : existing.condition,
    startIntersection: startIntersection !== undefined ? startIntersection?.trim() || null : existing.startIntersection,
    endIntersection: endIntersection !== undefined ? endIntersection?.trim() || null : existing.endIntersection,
    lanes: lanes !== undefined ? (lanes != null ? Number(lanes) : 2) : existing.lanes,
    hasSidewalk: hasSidewalk !== undefined ? Boolean(hasSidewalk) : existing.hasSidewalk,
    hasStreetLights: hasStreetLights !== undefined ? Boolean(hasStreetLights) : existing.hasStreetLights,
    hasDrainage: hasDrainage !== undefined ? Boolean(hasDrainage) : existing.hasDrainage,
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

// GET /blocks — single JOIN query; no N+1, no in-memory filtering
router.get("/blocks", requireAuth, async (req, res): Promise<void> => {
  const { kebele_id, street_id, status, search } = req.query as Record<string, string>;
  const user = req.user!;

  const conditions: ReturnType<typeof eq>[] = [];

  if (user.role === "kebele_officer" || user.role === "enumerator") {
    conditions.push(eq(blocksTable.status, "active") as ReturnType<typeof eq>);
    if (user.kebeleId) {
      conditions.push(eq(blocksTable.kebeleId, user.kebeleId) as ReturnType<typeof eq>);
    }
  } else {
    if (kebele_id) {
      const kid = parseInt(kebele_id, 10);
      if (!isNaN(kid)) conditions.push(eq(blocksTable.kebeleId, kid) as ReturnType<typeof eq>);
    }
    if (status) conditions.push(eq(blocksTable.status, status) as ReturnType<typeof eq>);
  }

  if (street_id) {
    const sid = parseInt(street_id, 10);
    if (!isNaN(sid)) conditions.push(eq(blocksTable.streetId, sid) as ReturnType<typeof eq>);
  }

  if (search) {
    conditions.push(ilike(blocksTable.code, `%${search}%`) as ReturnType<typeof eq>);
  }

  // Single JOIN resolves kebele + street names without N+1
  const rows = await db
    .select({
      id: blocksTable.id,
      code: blocksTable.code,
      kebeleId: blocksTable.kebeleId,
      kebeleName: kebelesTable.name,
      streetId: blocksTable.streetId,
      streetName: streetsTable.name,
      streetCode: streetsTable.code,
      description: blocksTable.description,
      status: blocksTable.status,
      createdAt: blocksTable.createdAt,
      updatedAt: blocksTable.updatedAt,
    })
    .from(blocksTable)
    .leftJoin(kebelesTable, eq(blocksTable.kebeleId, kebelesTable.id))
    .leftJoin(streetsTable, eq(blocksTable.streetId, streetsTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(blocksTable.code);

  res.json(
    rows.map((b) => ({
      id: b.id, code: b.code,
      kebeleId: b.kebeleId, kebeleName: b.kebeleName ?? null,
      streetId: b.streetId, streetName: b.streetName ?? null, streetCode: b.streetCode ?? null,
      description: b.description ?? null, status: b.status,
      createdAt: b.createdAt.toISOString(), updatedAt: b.updatedAt.toISOString(),
    })),
  );
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
    code: code.trim().toUpperCase(), kebeleId, streetId,
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

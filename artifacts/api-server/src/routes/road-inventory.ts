import { Router } from "express";
import { db, streetsTable, kebelesTable, roadMaintenanceRecordsTable, auditLogsTable } from "@workspace/db";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import { getClientIp, getDeviceInfo } from "../lib/audit";

const router = Router();

function parseId(v: unknown): number {
  return parseInt(String(v), 10);
}

function computePciRating(score: number | null | undefined): string | null {
  if (score == null || isNaN(score)) return null;
  if (score >= 85) return "good";
  if (score >= 70) return "satisfactory";
  if (score >= 55) return "fair";
  if (score >= 40) return "poor";
  if (score >= 25) return "very_poor";
  if (score >= 10) return "serious";
  return "failed";
}

function mapPciToCondition(pciRating: string | null): "good" | "fair" | "poor" | "under_maintenance" {
  if (!pciRating) return "good";
  if (pciRating === "good" || pciRating === "satisfactory") return "good";
  if (pciRating === "fair") return "fair";
  return "poor";
}

function computeMaintenancePriority(score: number | null | undefined): "routine" | "medium" | "high" | "critical" {
  if (score == null || isNaN(score)) return "routine";
  if (score < 40) return "critical";
  if (score < 55) return "high";
  if (score < 70) return "medium";
  return "routine";
}

async function writeAudit(
  userId: number,
  action: string,
  entityType: string,
  entityId: number,
  details: string,
) {
  try {
    await db.insert(auditLogsTable).values({
      userId,
      action,
      entityType,
      entityId,
      entityName: `Maintenance #${entityId}`,
      details,
    });
  } catch {
    // Ignore audit log write errors
  }
}

// GET /road-inventory/summary
router.get("/road-inventory/summary", requireAuth, async (req, res): Promise<void> => {
  try {
    const streets = await db.select().from(streetsTable);

    let totalLengthMeters = 0;
    let pciSum = 0;
    let pciCount = 0;
    let needsRepavingCount = 0;
    let upcomingInspectionsCount = 0;

    const pciTiers = {
      good: 0,
      satisfactory: 0,
      fair: 0,
      poor: 0,
      very_poor: 0,
      serious: 0,
      failed: 0,
    };

    const now = new Date();
    const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    for (const s of streets) {
      if (s.lengthMeters) totalLengthMeters += s.lengthMeters;

      if (s.lastPciScore != null) {
        pciSum += s.lastPciScore;
        pciCount++;

        const rating = s.lastPciRating || computePciRating(s.lastPciScore);
        if (rating && (rating in pciTiers)) {
          pciTiers[rating as keyof typeof pciTiers]++;
        }

        if (s.lastPciScore < 55 || s.maintenancePriority === "high" || s.maintenancePriority === "critical") {
          needsRepavingCount++;
        }
      }

      if (s.nextInspectionDate && s.nextInspectionDate >= now && s.nextInspectionDate <= in60Days) {
        upcomingInspectionsCount++;
      }
    }

    const records = await db.select().from(roadMaintenanceRecordsTable);
    let totalMaintenanceSpentEtb = 0;
    for (const r of records) {
      if (r.costEtb && r.status === "completed") {
        totalMaintenanceSpentEtb += r.costEtb;
      }
    }

    const totalKilometers = parseFloat((totalLengthMeters / 1000).toFixed(2));
    const averagePci = pciCount > 0 ? parseFloat((pciSum / pciCount).toFixed(1)) : 70.0;

    res.json({
      totalStreets: streets.length,
      totalKilometers,
      averagePci,
      needsRepavingCount,
      upcomingInspectionsCount,
      totalMaintenanceSpentEtb: Math.round(totalMaintenanceSpentEtb),
      pciTiers,
    });
  } catch (err) {
    console.error("Error computing road inventory summary:", err);
    res.status(500).json({ error: "Failed to generate road inventory summary" });
  }
});

// GET /road-inventory/records
router.get("/road-inventory/records", requireAuth, async (req, res): Promise<void> => {
  try {
    const { streetId, activityType, status } = req.query;

    const conditions = [];
    if (streetId) conditions.push(eq(roadMaintenanceRecordsTable.streetId, parseInt(String(streetId), 10)));
    if (activityType) conditions.push(eq(roadMaintenanceRecordsTable.activityType, String(activityType)));
    if (status) conditions.push(eq(roadMaintenanceRecordsTable.status, String(status)));

    const query = db
      .select({
        record: roadMaintenanceRecordsTable,
        streetName: streetsTable.name,
        streetCode: streetsTable.code,
        kebeleId: streetsTable.kebeleId,
        kebeleName: kebelesTable.name,
      })
      .from(roadMaintenanceRecordsTable)
      .innerJoin(streetsTable, eq(roadMaintenanceRecordsTable.streetId, streetsTable.id))
      .leftJoin(kebelesTable, eq(streetsTable.kebeleId, kebelesTable.id))
      .orderBy(desc(roadMaintenanceRecordsTable.performedDate));

    const rows = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

    const formatted = rows.map((r) => ({
      id: r.record.id,
      streetId: r.record.streetId,
      streetName: r.streetName,
      streetCode: r.streetCode,
      kebeleName: r.kebeleName ?? null,
      activityType: r.record.activityType,
      pciScore: r.record.pciScore ?? null,
      pciRating: r.record.pciRating ?? null,
      distressTypes: r.record.distressTypes ?? null,
      performedDate: r.record.performedDate.toISOString(),
      contractor: r.record.contractor ?? null,
      costEtb: r.record.costEtb ?? null,
      fundingSource: r.record.fundingSource ?? null,
      nextInspectionDue: r.record.nextInspectionDue ? r.record.nextInspectionDue.toISOString() : null,
      status: r.record.status,
      inspectorName: r.record.inspectorName ?? null,
      notes: r.record.notes ?? null,
      createdAt: r.record.createdAt.toISOString(),
      updatedAt: r.record.updatedAt.toISOString(),
    }));

    res.json(formatted);
  } catch (err) {
    console.error("Error listing road maintenance records:", err);
    res.status(500).json({ error: "Failed to list road maintenance records" });
  }
});

// GET /streets/:id/maintenance
router.get("/streets/:id/maintenance", requireAuth, async (req, res): Promise<void> => {
  try {
    const streetId = parseId(req.params.id);
    if (isNaN(streetId)) {
      res.status(400).json({ error: "Invalid street ID" });
      return;
    }

    const rows = await db
      .select({
        record: roadMaintenanceRecordsTable,
        streetName: streetsTable.name,
        streetCode: streetsTable.code,
        kebeleName: kebelesTable.name,
      })
      .from(roadMaintenanceRecordsTable)
      .innerJoin(streetsTable, eq(roadMaintenanceRecordsTable.streetId, streetsTable.id))
      .leftJoin(kebelesTable, eq(streetsTable.kebeleId, kebelesTable.id))
      .where(eq(roadMaintenanceRecordsTable.streetId, streetId))
      .orderBy(desc(roadMaintenanceRecordsTable.performedDate));

    const formatted = rows.map((r) => ({
      id: r.record.id,
      streetId: r.record.streetId,
      streetName: r.streetName,
      streetCode: r.streetCode,
      kebeleName: r.kebeleName ?? null,
      activityType: r.record.activityType,
      pciScore: r.record.pciScore ?? null,
      pciRating: r.record.pciRating ?? null,
      distressTypes: r.record.distressTypes ?? null,
      performedDate: r.record.performedDate.toISOString(),
      contractor: r.record.contractor ?? null,
      costEtb: r.record.costEtb ?? null,
      fundingSource: r.record.fundingSource ?? null,
      nextInspectionDue: r.record.nextInspectionDue ? r.record.nextInspectionDue.toISOString() : null,
      status: r.record.status,
      inspectorName: r.record.inspectorName ?? null,
      notes: r.record.notes ?? null,
      createdAt: r.record.createdAt.toISOString(),
      updatedAt: r.record.updatedAt.toISOString(),
    }));

    res.json(formatted);
  } catch (err) {
    console.error("Error fetching street maintenance history:", err);
    res.status(500).json({ error: "Failed to fetch street maintenance history" });
  }
});

// POST /road-inventory/records
router.post("/road-inventory/records", requireAuth, requireRole("admin", "city_officer"), async (req, res): Promise<void> => {
  try {
    const {
      streetId,
      activityType,
      pciScore,
      distressTypes,
      performedDate,
      contractor,
      costEtb,
      fundingSource,
      nextInspectionDue,
      status,
      inspectorName,
      notes,
    } = req.body;

    if (!streetId || !activityType || !performedDate) {
      res.status(400).json({ error: "streetId, activityType, and performedDate are required" });
      return;
    }

    const [street] = await db.select().from(streetsTable).where(eq(streetsTable.id, parseInt(String(streetId), 10)));
    if (!street) {
      res.status(400).json({ error: "Street not found" });
      return;
    }

    const numScore = pciScore != null && pciScore !== "" ? parseInt(String(pciScore), 10) : null;
    const computedRating = computePciRating(numScore);

    const [created] = await db
      .insert(roadMaintenanceRecordsTable)
      .values({
        streetId: street.id,
        activityType: String(activityType),
        pciScore: numScore,
        pciRating: computedRating,
        distressTypes: distressTypes?.trim() || null,
        performedDate: new Date(performedDate),
        contractor: contractor?.trim() || null,
        costEtb: costEtb != null && costEtb !== "" ? parseFloat(String(costEtb)) : null,
        fundingSource: fundingSource?.trim() || null,
        nextInspectionDue: nextInspectionDue ? new Date(nextInspectionDue) : null,
        status: status || "completed",
        inspectorName: inspectorName?.trim() || null,
        notes: notes?.trim() || null,
      })
      .returning();

    // Automatically sync parent street condition, PCI score, next inspection, and resurfacing year
    const streetUpdates: Record<string, unknown> = {};

    if (numScore != null) {
      streetUpdates.lastPciScore = numScore;
      streetUpdates.lastPciRating = computedRating;
      streetUpdates.condition = mapPciToCondition(computedRating);
      streetUpdates.maintenancePriority = computeMaintenancePriority(numScore);
    }

    if (nextInspectionDue) {
      streetUpdates.nextInspectionDate = new Date(nextInspectionDue);
    }

    if (activityType === "resurfacing" && (status === "completed" || !status)) {
      streetUpdates.lastResurfacedYear = new Date(performedDate).getFullYear();
      if (!numScore) {
        streetUpdates.condition = "good";
      }
    }

    if (Object.keys(streetUpdates).length > 0) {
      await db.update(streetsTable).set(streetUpdates).where(eq(streetsTable.id, street.id));
    }

    await writeAudit(
      req.user!.userId,
      "create_road_maintenance",
      "road_maintenance",
      created.id,
      `Logged ${created.activityType} for street ${street.name} (${street.code})`,
    );

    const [kebele] = await db.select().from(kebelesTable).where(eq(kebelesTable.id, street.kebeleId));

    res.status(201).json({
      id: created.id,
      streetId: created.streetId,
      streetName: street.name,
      streetCode: street.code,
      kebeleName: kebele?.name ?? null,
      activityType: created.activityType,
      pciScore: created.pciScore,
      pciRating: created.pciRating,
      distressTypes: created.distressTypes,
      performedDate: created.performedDate.toISOString(),
      contractor: created.contractor,
      costEtb: created.costEtb,
      fundingSource: created.fundingSource,
      nextInspectionDue: created.nextInspectionDue ? created.nextInspectionDue.toISOString() : null,
      status: created.status,
      inspectorName: created.inspectorName,
      notes: created.notes,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    });
  } catch (err) {
    console.error("Error creating road maintenance record:", err);
    res.status(500).json({ error: "Failed to create road maintenance record" });
  }
});

// PUT /road-inventory/records/:id
router.put("/road-inventory/records/:id", requireAuth, requireRole("admin", "city_officer"), async (req, res): Promise<void> => {
  try {
    const id = parseId(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid record ID" });
      return;
    }

    const [existing] = await db.select().from(roadMaintenanceRecordsTable).where(eq(roadMaintenanceRecordsTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Maintenance record not found" });
      return;
    }

    const {
      streetId,
      activityType,
      pciScore,
      distressTypes,
      performedDate,
      contractor,
      costEtb,
      fundingSource,
      nextInspectionDue,
      status,
      inspectorName,
      notes,
    } = req.body;

    const numScore = pciScore != null && pciScore !== "" ? parseInt(String(pciScore), 10) : null;
    const computedRating = computePciRating(numScore);

    const [updated] = await db
      .update(roadMaintenanceRecordsTable)
      .set({
        streetId: streetId ? parseInt(String(streetId), 10) : existing.streetId,
        activityType: activityType || existing.activityType,
        pciScore: numScore,
        pciRating: computedRating,
        distressTypes: distressTypes !== undefined ? (distressTypes?.trim() || null) : existing.distressTypes,
        performedDate: performedDate ? new Date(performedDate) : existing.performedDate,
        contractor: contractor !== undefined ? (contractor?.trim() || null) : existing.contractor,
        costEtb: costEtb != null && costEtb !== "" ? parseFloat(String(costEtb)) : null,
        fundingSource: fundingSource !== undefined ? (fundingSource?.trim() || null) : existing.fundingSource,
        nextInspectionDue: nextInspectionDue ? new Date(nextInspectionDue) : null,
        status: status || existing.status,
        inspectorName: inspectorName !== undefined ? (inspectorName?.trim() || null) : existing.inspectorName,
        notes: notes !== undefined ? (notes?.trim() || null) : existing.notes,
        updatedAt: new Date(),
      })
      .where(eq(roadMaintenanceRecordsTable.id, id))
      .returning();

    // Sync parent street if PCI or inspection changed
    const targetStreetId = updated.streetId;
    const streetUpdates: Record<string, unknown> = {};

    if (numScore != null) {
      streetUpdates.lastPciScore = numScore;
      streetUpdates.lastPciRating = computedRating;
      streetUpdates.condition = mapPciToCondition(computedRating);
      streetUpdates.maintenancePriority = computeMaintenancePriority(numScore);
    }

    if (nextInspectionDue) {
      streetUpdates.nextInspectionDate = new Date(nextInspectionDue);
    }

    if (updated.activityType === "resurfacing" && updated.status === "completed") {
      streetUpdates.lastResurfacedYear = new Date(updated.performedDate).getFullYear();
    }

    if (Object.keys(streetUpdates).length > 0) {
      await db.update(streetsTable).set(streetUpdates).where(eq(streetsTable.id, targetStreetId));
    }

    await writeAudit(
      req.user!.userId,
      "update_road_maintenance",
      "road_maintenance",
      updated.id,
      `Updated maintenance record #${updated.id}`,
    );

    const [street] = await db.select().from(streetsTable).where(eq(streetsTable.id, targetStreetId));
    const [kebele] = street ? await db.select().from(kebelesTable).where(eq(kebelesTable.id, street.kebeleId)) : [null];

    res.json({
      id: updated.id,
      streetId: updated.streetId,
      streetName: street?.name ?? null,
      streetCode: street?.code ?? null,
      kebeleName: kebele?.name ?? null,
      activityType: updated.activityType,
      pciScore: updated.pciScore,
      pciRating: updated.pciRating,
      distressTypes: updated.distressTypes,
      performedDate: updated.performedDate.toISOString(),
      contractor: updated.contractor,
      costEtb: updated.costEtb,
      fundingSource: updated.fundingSource,
      nextInspectionDue: updated.nextInspectionDue ? updated.nextInspectionDue.toISOString() : null,
      status: updated.status,
      inspectorName: updated.inspectorName,
      notes: updated.notes,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    console.error("Error updating road maintenance record:", err);
    res.status(500).json({ error: "Failed to update road maintenance record" });
  }
});

// DELETE /road-inventory/records/:id
router.delete("/road-inventory/records/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const id = parseId(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid record ID" });
      return;
    }

    const [existing] = await db.select().from(roadMaintenanceRecordsTable).where(eq(roadMaintenanceRecordsTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Record not found" });
      return;
    }

    await db.delete(roadMaintenanceRecordsTable).where(eq(roadMaintenanceRecordsTable.id, id));
    await writeAudit(
      req.user!.userId,
      "delete_road_maintenance",
      "road_maintenance",
      id,
      `Deleted maintenance record #${id}`,
    );

    res.status(204).end();
  } catch (err) {
    console.error("Error deleting road maintenance record:", err);
    res.status(500).json({ error: "Failed to delete maintenance record" });
  }
});

export default router;

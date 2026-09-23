import { Router } from "express";
import { db, landParcelsTable, buildingsTable, propertiesTable, kebelesTable } from "@workspace/db";
import { eq, and, ilike, desc, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import { writeAudit } from "../lib/audit";

const router = Router();

// GET /api/parcels - List parcels with filtering and pagination
router.get("/", requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const offset = (page - 1) * limit;

    const search = req.query.search as string | undefined;
    const kebele = req.query.kebele as string | undefined;
    const zoning = req.query.zoning as string | undefined;
    const tenure = req.query.tenure as string | undefined;
    const status = req.query.status as string | undefined;

    const conditions = [];

    if (search && search.trim() !== "") {
      const q = `%${search.trim()}%`;
      conditions.push(
        sql`(${landParcelsTable.parcelUpi} ILIKE ${q} OR ${landParcelsTable.titleDeedNumber} ILIKE ${q} OR ${landParcelsTable.streetName} ILIKE ${q})`
      );
    }

    if (kebele && kebele !== "all") {
      conditions.push(eq(landParcelsTable.kebele, kebele));
    }

    if (zoning && zoning !== "all") {
      conditions.push(eq(landParcelsTable.zoningClassification, zoning));
    }

    if (tenure && tenure !== "all") {
      conditions.push(eq(landParcelsTable.landTenure, tenure));
    }

    if (status && status !== "all") {
      conditions.push(eq(landParcelsTable.status, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(landParcelsTable)
      .where(whereClause);

    const total = countResult?.count ?? 0;

    // Fetch parcels with building count and properties unit count
    const rows = await db
      .select({
        parcel: landParcelsTable,
        buildingCount: sql<number>`(SELECT count(*)::int FROM buildings b WHERE b.parcel_id = "land_parcels"."id")`,
        unitCount: sql<number>`(SELECT count(*)::int FROM properties pr WHERE pr.parcel_id = "land_parcels"."id")`,
      })
      .from(landParcelsTable)
      .where(whereClause)
      .orderBy(desc(landParcelsTable.createdAt))
      .limit(limit)
      .offset(offset);

    const parcels = rows.map(({ parcel, buildingCount, unitCount }) => ({
      ...parcel,
      buildingCount: buildingCount || 0,
      unitCount: unitCount || 0,
      createdAt: parcel.createdAt.toISOString(),
      updatedAt: parcel.updatedAt.toISOString(),
    }));

    res.json({ parcels, total, page, limit });
  } catch (err) {
    console.error("Failed to list parcels:", err);
    res.status(500).json({ error: "Failed to list parcels" });
  }
});

// GET /api/parcels/:id - Get single parcel with buildings and properties
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid parcel ID" });

    const [parcel] = await db
      .select()
      .from(landParcelsTable)
      .where(eq(landParcelsTable.id, id))
      .limit(1);

    if (!parcel) {
      return res.status(400).json({ error: "Parcel not found" });
    }

    // Get buildings on this parcel
    const buildings = await db
      .select()
      .from(buildingsTable)
      .where(eq(buildingsTable.parcelId, id));

    // Get addressable properties / units on this parcel
    const units = await db
      .select({
        id: propertiesTable.id,
        addressCode: propertiesTable.addressCode,
        houseNumber: propertiesTable.houseNumber,
        unitNumber: propertiesTable.unitNumber,
        ownerName: propertiesTable.ownerName,
        propertyType: propertiesTable.propertyType,
        buildingUse: propertiesTable.buildingUse,
        status: propertiesTable.status,
      })
      .from(propertiesTable)
      .where(eq(propertiesTable.parcelId, id));

    res.json({
      ...parcel,
      createdAt: parcel.createdAt.toISOString(),
      updatedAt: parcel.updatedAt.toISOString(),
      buildings,
      units,
    });
  } catch (err) {
    console.error("Failed to get parcel:", err);
    res.status(500).json({ error: "Failed to get parcel details" });
  }
});

// POST /api/parcels - Create new parcel
router.post("/", requireAuth, requireRole(["admin", "city_officer", "kebele_officer"]), async (req, res) => {
  try {
    const {
      parcelUpi,
      kebele,
      kebeleId,
      blockCode,
      streetId,
      streetName,
      areaSqm,
      landTenure,
      titleDeedNumber,
      zoningClassification,
      centerLat,
      centerLng,
      boundaryPolygon,
    } = req.body;

    if (!kebele) {
      return res.status(400).json({ error: "Kebele is required" });
    }

    // Generate UPI if not provided
    let finalUpi = parcelUpi;
    if (!finalUpi || finalUpi.trim() === "") {
      const kebeleCode = kebele.replace(/\s+/g, "").toUpperCase().slice(0, 4);
      const blkCode = (blockCode || "BL01").replace(/\s+/g, "").toUpperCase();
      const rand = Math.floor(1000 + Math.random() * 9000);
      finalUpi = `JMA-${kebeleCode}-${blkCode}-P${rand}`;
    }

    const [newParcel] = await db
      .insert(landParcelsTable)
      .values({
        parcelUpi: finalUpi,
        kebele,
        kebeleId: kebeleId ? parseInt(kebeleId, 10) : null,
        blockCode: blockCode || null,
        streetId: streetId ? parseInt(streetId, 10) : null,
        streetName: streetName || null,
        areaSqm: areaSqm ? parseFloat(areaSqm) : null,
        landTenure: landTenure || "leasehold",
        titleDeedNumber: titleDeedNumber || null,
        zoningClassification: zoningClassification || "residential",
        centerLat: centerLat ? parseFloat(centerLat) : null,
        centerLng: centerLng ? parseFloat(centerLng) : null,
        boundaryPolygon: boundaryPolygon || null,
        status: "registered",
        createdBy: req.user?.id ?? null,
      })
      .returning();

    await writeAudit({
      userId: req.user?.id,
      action: "PARCEL_CREATED",
      entityType: "land_parcels",
      entityId: newParcel.id,
      details: `Registered land parcel UPI: ${newParcel.parcelUpi} in ${newParcel.kebele}`,
    });

    res.status(201).json({
      ...newParcel,
      createdAt: newParcel.createdAt.toISOString(),
      updatedAt: newParcel.updatedAt.toISOString(),
    });
  } catch (err: any) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "A parcel with this UPI already exists" });
    }
    console.error("Failed to create parcel:", err);
    res.status(500).json({ error: "Failed to create parcel" });
  }
});

// PUT /api/parcels/:id - Update parcel
router.put("/:id", requireAuth, requireRole(["admin", "city_officer"]), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid parcel ID" });

    const {
      kebele,
      blockCode,
      streetName,
      areaSqm,
      landTenure,
      titleDeedNumber,
      zoningClassification,
      centerLat,
      centerLng,
      boundaryPolygon,
      status,
    } = req.body;

    const [updated] = await db
      .update(landParcelsTable)
      .set({
        kebele: kebele !== undefined ? kebele : undefined,
        blockCode: blockCode !== undefined ? blockCode : undefined,
        streetName: streetName !== undefined ? streetName : undefined,
        areaSqm: areaSqm !== undefined ? (areaSqm ? parseFloat(areaSqm) : null) : undefined,
        landTenure: landTenure !== undefined ? landTenure : undefined,
        titleDeedNumber: titleDeedNumber !== undefined ? titleDeedNumber : undefined,
        zoningClassification: zoningClassification !== undefined ? zoningClassification : undefined,
        centerLat: centerLat !== undefined ? (centerLat ? parseFloat(centerLat) : null) : undefined,
        centerLng: centerLng !== undefined ? (centerLng ? parseFloat(centerLng) : null) : undefined,
        boundaryPolygon: boundaryPolygon !== undefined ? boundaryPolygon : undefined,
        status: status !== undefined ? status : undefined,
        updatedAt: new Date(),
      })
      .where(eq(landParcelsTable.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Parcel not found" });
    }

    await writeAudit({
      userId: req.user?.id,
      action: "PARCEL_UPDATED",
      entityType: "land_parcels",
      entityId: id,
      details: `Updated parcel ${updated.parcelUpi}`,
    });

    res.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    console.error("Failed to update parcel:", err);
    res.status(500).json({ error: "Failed to update parcel" });
  }
});

// DELETE /api/parcels/:id - Delete parcel
router.delete("/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid parcel ID" });

    const [deleted] = await db
      .delete(landParcelsTable)
      .where(eq(landParcelsTable.id, id))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Parcel not found" });
    }

    await writeAudit({
      userId: req.user?.id,
      action: "PARCEL_DELETED",
      entityType: "land_parcels",
      entityId: id,
      details: `Deleted parcel ${deleted.parcelUpi}`,
    });

    res.status(204).send();
  } catch (err) {
    console.error("Failed to delete parcel:", err);
    res.status(500).json({ error: "Failed to delete parcel" });
  }
});

export default router;

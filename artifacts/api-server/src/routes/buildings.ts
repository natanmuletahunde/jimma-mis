import { Router } from "express";
import { db, buildingsTable, landParcelsTable, propertiesTable } from "@workspace/db";
import { eq, and, ilike, desc, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import { writeAudit } from "../lib/audit";

const router = Router();

// GET /api/buildings - List buildings with filtering and pagination
router.get("/", requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const offset = (page - 1) * limit;

    const search = req.query.search as string | undefined;
    const parcelId = req.query.parcelId ? parseInt(req.query.parcelId as string, 10) : undefined;
    const buildingUse = req.query.buildingUse as string | undefined;
    const structureType = req.query.structureType as string | undefined;
    const condition = req.query.condition as string | undefined;

    const conditions = [];

    if (search && search.trim() !== "") {
      const q = `%${search.trim()}%`;
      conditions.push(
        sql`(${buildingsTable.buildingCode} ILIKE ${q} OR ${buildingsTable.buildingName} ILIKE ${q} OR ${buildingsTable.permitNumber} ILIKE ${q})`
      );
    }

    if (parcelId) {
      conditions.push(eq(buildingsTable.parcelId, parcelId));
    }

    if (buildingUse && buildingUse !== "all") {
      conditions.push(eq(buildingsTable.buildingUse, buildingUse));
    }

    if (structureType && structureType !== "all") {
      conditions.push(eq(buildingsTable.structureType, structureType));
    }

    if (condition && condition !== "all") {
      conditions.push(eq(buildingsTable.buildingCondition, condition));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(buildingsTable)
      .where(whereClause);

    const total = countResult?.count ?? 0;

    // Fetch buildings joined with parcel and unit count
    const rows = await db
      .select({
        building: buildingsTable,
        parcelUpi: landParcelsTable.parcelUpi,
        parcelKebele: landParcelsTable.kebele,
        parcelStreet: landParcelsTable.streetName,
        unitCount: sql<number>`(SELECT count(*)::int FROM properties pr WHERE pr.building_id = "buildings"."id")`,
      })
      .from(buildingsTable)
      .leftJoin(landParcelsTable, eq(buildingsTable.parcelId, landParcelsTable.id))
      .where(whereClause)
      .orderBy(desc(buildingsTable.createdAt))
      .limit(limit)
      .offset(offset);

    const buildings = rows.map(({ building, parcelUpi, parcelKebele, parcelStreet, unitCount }) => ({
      ...building,
      parcelUpi: parcelUpi || null,
      parcelKebele: parcelKebele || null,
      parcelStreet: parcelStreet || null,
      unitCount: unitCount || 0,
      createdAt: building.createdAt.toISOString(),
      updatedAt: building.updatedAt.toISOString(),
    }));

    res.json({ buildings, total, page, limit });
  } catch (err) {
    console.error("Failed to list buildings:", err);
    res.status(500).json({ error: "Failed to list buildings" });
  }
});

// GET /api/buildings/:id - Get single building with parent parcel and units
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid building ID" });

    const [result] = await db
      .select({
        building: buildingsTable,
        parcel: landParcelsTable,
      })
      .from(buildingsTable)
      .leftJoin(landParcelsTable, eq(buildingsTable.parcelId, landParcelsTable.id))
      .where(eq(buildingsTable.id, id))
      .limit(1);

    if (!result) {
      return res.status(404).json({ error: "Building not found" });
    }

    // Get units inside this building
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
      .where(eq(propertiesTable.buildingId, id));

    res.json({
      ...result.building,
      createdAt: result.building.createdAt.toISOString(),
      updatedAt: result.building.updatedAt.toISOString(),
      parcel: result.parcel ? {
        ...result.parcel,
        createdAt: result.parcel.createdAt.toISOString(),
        updatedAt: result.parcel.updatedAt.toISOString(),
      } : null,
      units,
    });
  } catch (err) {
    console.error("Failed to get building:", err);
    res.status(500).json({ error: "Failed to get building details" });
  }
});

// POST /api/buildings - Create new building structure
router.post("/", requireAuth, requireRole(["admin", "city_officer", "kebele_officer"]), async (req, res) => {
  try {
    const {
      buildingCode,
      parcelId,
      buildingName,
      structureType,
      foundationType,
      roofMaterial,
      constructionYear,
      numberOfFloors,
      footprintAreaSqm,
      totalFloorAreaSqm,
      buildingUse,
      buildingCondition,
      hasBuildingPermit,
      permitNumber,
      latitude,
      longitude,
      photoUrl,
    } = req.body;

    let finalCode = buildingCode;
    if (!finalCode || finalCode.trim() === "") {
      const rand = Math.floor(1000 + Math.random() * 9000);
      finalCode = `BLD-JMA-${rand}-B1`;
    }

    const floors = numberOfFloors ? parseInt(numberOfFloors, 10) : 1;
    const footprint = footprintAreaSqm ? parseFloat(footprintAreaSqm) : null;
    const totalArea = totalFloorAreaSqm ? parseFloat(totalFloorAreaSqm) : (footprint ? footprint * floors : null);

    const [newBuilding] = await db
      .insert(buildingsTable)
      .values({
        buildingCode: finalCode,
        parcelId: parcelId ? parseInt(parcelId, 10) : null,
        buildingName: buildingName || null,
        structureType: structureType || "reinforced_concrete",
        foundationType: foundationType || "strip_footing",
        roofMaterial: roofMaterial || "corrugated_iron_sheet",
        constructionYear: constructionYear ? parseInt(constructionYear, 10) : new Date().getFullYear(),
        numberOfFloors: floors,
        footprintAreaSqm: footprint,
        totalFloorAreaSqm: totalArea,
        buildingUse: buildingUse || "residential",
        buildingCondition: buildingCondition || "good",
        hasBuildingPermit: hasBuildingPermit !== undefined ? Boolean(hasBuildingPermit) : true,
        permitNumber: permitNumber || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        photoUrl: photoUrl || null,
        status: "active",
        createdBy: req.user?.id ?? null,
      })
      .returning();

    await writeAudit({
      userId: req.user?.id,
      action: "BUILDING_CREATED",
      entityType: "buildings",
      entityId: newBuilding.id,
      details: `Registered building structure ${newBuilding.buildingCode} (${newBuilding.buildingName || 'Unnamed'})`,
    });

    res.status(201).json({
      ...newBuilding,
      createdAt: newBuilding.createdAt.toISOString(),
      updatedAt: newBuilding.updatedAt.toISOString(),
    });
  } catch (err: any) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "A building with this code already exists" });
    }
    console.error("Failed to create building:", err);
    res.status(500).json({ error: "Failed to create building" });
  }
});

// PUT /api/buildings/:id - Update building
router.put("/:id", requireAuth, requireRole(["admin", "city_officer"]), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid building ID" });

    const {
      buildingName,
      structureType,
      foundationType,
      roofMaterial,
      constructionYear,
      numberOfFloors,
      footprintAreaSqm,
      totalFloorAreaSqm,
      buildingUse,
      buildingCondition,
      hasBuildingPermit,
      permitNumber,
      latitude,
      longitude,
      status,
    } = req.body;

    const [updated] = await db
      .update(buildingsTable)
      .set({
        buildingName: buildingName !== undefined ? buildingName : undefined,
        structureType: structureType !== undefined ? structureType : undefined,
        foundationType: foundationType !== undefined ? foundationType : undefined,
        roofMaterial: roofMaterial !== undefined ? roofMaterial : undefined,
        constructionYear: constructionYear !== undefined ? parseInt(constructionYear, 10) : undefined,
        numberOfFloors: numberOfFloors !== undefined ? parseInt(numberOfFloors, 10) : undefined,
        footprintAreaSqm: footprintAreaSqm !== undefined ? (footprintAreaSqm ? parseFloat(footprintAreaSqm) : null) : undefined,
        totalFloorAreaSqm: totalFloorAreaSqm !== undefined ? (totalFloorAreaSqm ? parseFloat(totalFloorAreaSqm) : null) : undefined,
        buildingUse: buildingUse !== undefined ? buildingUse : undefined,
        buildingCondition: buildingCondition !== undefined ? buildingCondition : undefined,
        hasBuildingPermit: hasBuildingPermit !== undefined ? Boolean(hasBuildingPermit) : undefined,
        permitNumber: permitNumber !== undefined ? permitNumber : undefined,
        latitude: latitude !== undefined ? (latitude ? parseFloat(latitude) : null) : undefined,
        longitude: longitude !== undefined ? (longitude ? parseFloat(longitude) : null) : undefined,
        status: status !== undefined ? status : undefined,
        updatedAt: new Date(),
      })
      .where(eq(buildingsTable.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Building not found" });
    }

    await writeAudit({
      userId: req.user?.id,
      action: "BUILDING_UPDATED",
      entityType: "buildings",
      entityId: id,
      details: `Updated building ${updated.buildingCode}`,
    });

    res.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    console.error("Failed to update building:", err);
    res.status(500).json({ error: "Failed to update building" });
  }
});

// DELETE /api/buildings/:id - Delete building
router.delete("/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid building ID" });

    const [deleted] = await db
      .delete(buildingsTable)
      .where(eq(buildingsTable.id, id))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Building not found" });
    }

    await writeAudit({
      userId: req.user?.id,
      action: "BUILDING_DELETED",
      entityType: "buildings",
      entityId: id,
      details: `Deleted building ${deleted.buildingCode}`,
    });

    res.status(204).send();
  } catch (err) {
    console.error("Failed to delete building:", err);
    res.status(500).json({ error: "Failed to delete building" });
  }
});

export default router;

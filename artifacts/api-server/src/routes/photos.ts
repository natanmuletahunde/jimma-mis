import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { Router } from "express";
import multer from "multer";
import { db, propertiesTable, propertyPhotosTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, "../uploads/properties");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const ALLOWED_MIMETYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const PHOTO_CATEGORIES = ["front_view", "side_view", "business_sign", "document", "other"];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `property_${req.params.id}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
      cb(new Error("Only JPG, PNG, and WEBP images are allowed (max 5 MB)"));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

function safeUnlink(filePath: string) {
  fs.unlink(filePath, () => {});
}

// GET /properties/:id/photos
router.get("/properties/:id/photos", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid property ID" }); return; }

  const [property] = await db
    .select({ id: propertiesTable.id })
    .from(propertiesTable)
    .where(eq(propertiesTable.id, id));
  if (!property) { res.status(404).json({ error: "Property not found" }); return; }

  const photos = await db
    .select({
      id: propertyPhotosTable.id,
      propertyId: propertyPhotosTable.propertyId,
      photoUrl: propertyPhotosTable.photoUrl,
      fileName: propertyPhotosTable.fileName,
      fileType: propertyPhotosTable.fileType,
      photoCategory: propertyPhotosTable.photoCategory,
      uploadedBy: propertyPhotosTable.uploadedBy,
      createdAt: propertyPhotosTable.createdAt,
      uploaderName: usersTable.fullName,
    })
    .from(propertyPhotosTable)
    .leftJoin(usersTable, eq(propertyPhotosTable.uploadedBy, usersTable.id))
    .where(eq(propertyPhotosTable.propertyId, id))
    .orderBy(propertyPhotosTable.createdAt);

  res.json(photos.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })));
});

// POST /properties/:id/photos
router.post(
  "/properties/:id/photos",
  requireAuth,
  upload.single("photo"),
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid property ID" }); return; }

    if (!req.file) { res.status(400).json({ error: "No photo file uploaded" }); return; }

    const user = req.user!;
    const canUpload = user.role === "admin" || user.role === "enumerator";
    if (!canUpload) {
      safeUnlink(req.file.path);
      res.status(403).json({ error: "Only enumerators and admins can upload photos" });
      return;
    }

    const [property] = await db
      .select()
      .from(propertiesTable)
      .where(eq(propertiesTable.id, id));
    if (!property) {
      safeUnlink(req.file.path);
      res.status(404).json({ error: "Property not found" });
      return;
    }

    if (user.role === "enumerator") {
      if (property.createdBy !== user.userId) {
        safeUnlink(req.file.path);
        res.status(403).json({ error: "You can only upload photos for your own properties" });
        return;
      }
      if (property.status !== "draft" && property.status !== "rejected") {
        safeUnlink(req.file.path);
        res.status(400).json({ error: "Photos can only be added to draft or rejected properties" });
        return;
      }
    }

    const category = ((req.body as { category?: string }).category ?? "other").trim();
    if (!PHOTO_CATEGORIES.includes(category)) {
      safeUnlink(req.file.path);
      res.status(400).json({ error: `Invalid category. Use one of: ${PHOTO_CATEGORIES.join(", ")}` });
      return;
    }

    const photoUrl = `/uploads/properties/${req.file.filename}`;

    const [inserted] = await db
      .insert(propertyPhotosTable)
      .values({
        propertyId: id,
        photoUrl,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        photoCategory: category,
        uploadedBy: user.userId,
      })
      .returning();

    // Keep properties.property_photo in sync — prefer front_view; otherwise first photo
    if (category === "front_view" || !property.propertyPhoto) {
      await db
        .update(propertiesTable)
        .set({ propertyPhoto: photoUrl })
        .where(eq(propertiesTable.id, id));
    }

    res.status(201).json({ ...inserted, createdAt: inserted.createdAt.toISOString() });
  },
);

// DELETE /properties/:id/photos/:photoId  — admin only
router.delete(
  "/properties/:id/photos/:photoId",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const rawPhotoId = Array.isArray(req.params.photoId) ? req.params.photoId[0] : req.params.photoId;
    const id = parseInt(rawId, 10);
    const photoId = parseInt(rawPhotoId, 10);
    if (isNaN(id) || isNaN(photoId)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [photo] = await db
      .select()
      .from(propertyPhotosTable)
      .where(and(eq(propertyPhotosTable.id, photoId), eq(propertyPhotosTable.propertyId, id)));
    if (!photo) { res.status(404).json({ error: "Photo not found" }); return; }

    // Remove physical file
    const absPath = path.resolve(__dirname, "../../", photo.photoUrl.replace(/^\//, ""));
    safeUnlink(absPath);

    await db.delete(propertyPhotosTable).where(eq(propertyPhotosTable.id, photoId));

    // If deleted photo was the main property_photo, update to next available or clear
    const [prop] = await db
      .select({ propertyPhoto: propertiesTable.propertyPhoto })
      .from(propertiesTable)
      .where(eq(propertiesTable.id, id));

    if (prop?.propertyPhoto === photo.photoUrl) {
      const [next] = await db
        .select({ photoUrl: propertyPhotosTable.photoUrl })
        .from(propertyPhotosTable)
        .where(eq(propertyPhotosTable.propertyId, id))
        .orderBy(propertyPhotosTable.createdAt)
        .limit(1);
      await db
        .update(propertiesTable)
        .set({ propertyPhoto: next?.photoUrl ?? null })
        .where(eq(propertiesTable.id, id));
    }

    res.status(204).send();
  },
);

export default router;

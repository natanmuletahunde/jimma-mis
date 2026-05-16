import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, kebelesTable } from "@workspace/db";
import { writeAudit as _audit } from "../lib/audit";
import { eq, ilike, or, and, ne } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

const DEFAULT_PASSWORD = "Password@123";

const ROLES = [
  { value: "admin", label: "Administrator" },
  { value: "city_officer", label: "City Officer" },
  { value: "kebele_officer", label: "Kebele Officer" },
  { value: "enumerator", label: "Enumerator" },
  { value: "viewer", label: "Viewer" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────────

async function sanitizeUser(user: typeof usersTable.$inferSelect) {
  let kebeleName: string | null = null;
  if (user.kebeleId) {
    const [k] = await db
      .select({ name: kebelesTable.name })
      .from(kebelesTable)
      .where(eq(kebelesTable.id, user.kebeleId))
      .limit(1);
    kebeleName = k?.name ?? null;
  }
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email ?? null,
    phone: user.phone ?? null,
    role: user.role,
    kebeleId: user.kebeleId ?? null,
    kebeleName,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt?.toISOString() ?? null,
  };
}

async function writeAudit(actorId: number, action: string, entityId: number, details?: string) {
  await _audit({ userId: actorId, action, entityType: "user", entityId, details: details ?? null });
}

// ─── GET /roles ──────────────────────────────────────────────────────────────────

router.get("/roles", requireAuth, (_req, res): void => {
  res.json(ROLES);
});

// ─── GET /users ──────────────────────────────────────────────────────────────────

router.get(
  "/users",
  requireAuth,
  requireRole("admin", "city_officer"),
  async (req, res): Promise<void> => {
    const { role, search, status } = req.query as Record<string, string>;
    const conditions: ReturnType<typeof eq>[] = [];

    if (role) conditions.push(eq(usersTable.role, role) as ReturnType<typeof eq>);

    if (status === "active") {
      conditions.push(eq(usersTable.isActive, true) as ReturnType<typeof eq>);
    } else if (status === "inactive") {
      conditions.push(eq(usersTable.isActive, false) as ReturnType<typeof eq>);
    }

    if (search) {
      conditions.push(
        or(
          ilike(usersTable.fullName, `%${search}%`),
          ilike(usersTable.username, `%${search}%`),
          ilike(usersTable.email, `%${search}%`),
          ilike(usersTable.phone, `%${search}%`),
        ) as ReturnType<typeof eq>,
      );
    }

    const rows =
      conditions.length > 0
        ? await db.select().from(usersTable).where(and(...conditions))
        : await db.select().from(usersTable);

    const result = await Promise.all(rows.map(sanitizeUser));
    res.json(result);
  },
);

// ─── POST /users ─────────────────────────────────────────────────────────────────

router.post(
  "/users",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const { username, password, fullName, email, phone, role, kebeleId } =
      req.body as {
        username: string;
        password?: string;
        fullName: string;
        email?: string;
        phone?: string;
        role: string;
        kebeleId?: number | null;
      };

    if (!username || !fullName || !role) {
      res.status(400).json({ error: "username, fullName and role are required" });
      return;
    }

    if (["kebele_officer", "enumerator"].includes(role) && !kebeleId) {
      res.status(400).json({
        error: "kebeleId is required for Kebele Officer and Enumerator roles",
      });
      return;
    }

    if (email) {
      const [existing] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, email))
        .limit(1);
      if (existing) {
        res.status(409).json({ error: "Email address is already in use" });
        return;
      }
    }

    const rawPassword = password || DEFAULT_PASSWORD;
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const [user] = await db
      .insert(usersTable)
      .values({
        username,
        passwordHash,
        fullName,
        email: email || null,
        phone: phone || null,
        role,
        kebeleId: kebeleId ?? null,
        isActive: true,
      })
      .returning();

    await writeAudit(
      req.user!.userId,
      "create_user",
      user.id,
      `Created user ${username} with role ${role}`,
    );

    res.status(201).json(await sanitizeUser(user));
  },
);

// ─── GET /users/:id ──────────────────────────────────────────────────────────────

router.get(
  "/users/:id",
  requireAuth,
  requireRole("admin", "city_officer"),
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid user ID" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json(await sanitizeUser(user));
  },
);

// ─── PATCH /users/:id ────────────────────────────────────────────────────────────

router.patch(
  "/users/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid user ID" }); return; }

    const { password, email, role, kebeleId, ...rest } = req.body as {
      password?: string;
      email?: string;
      role?: string;
      kebeleId?: number | null;
      fullName?: string;
      phone?: string;
      isActive?: boolean;
    };

    if (role && ["kebele_officer", "enumerator"].includes(role)) {
      const resolvedKebeleId = kebeleId !== undefined ? kebeleId : null;
      if (!resolvedKebeleId) {
        res.status(400).json({
          error: "kebeleId is required for Kebele Officer and Enumerator roles",
        });
        return;
      }
    }

    if (email) {
      const [existing] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(and(eq(usersTable.email, email), ne(usersTable.id, id)))
        .limit(1);
      if (existing) {
        res.status(409).json({ error: "Email address is already in use" });
        return;
      }
    }

    const updateData: Record<string, unknown> = { ...rest };
    if (email !== undefined) updateData.email = email || null;
    if (role !== undefined) updateData.role = role;
    if (kebeleId !== undefined) updateData.kebeleId = kebeleId ?? null;
    if (password) updateData.passwordHash = await bcrypt.hash(password, 10);

    const [user] = await db
      .update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, id))
      .returning();

    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    await writeAudit(
      req.user!.userId,
      "update_user",
      id,
      `Updated user ${user.username}`,
    );

    res.json(await sanitizeUser(user));
  },
);

// ─── PATCH /users/:id/status ─────────────────────────────────────────────────────

router.patch(
  "/users/:id/status",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid user ID" }); return; }

    const { isActive, remark } = req.body as { isActive: boolean; remark?: string };

    if (typeof isActive !== "boolean") {
      res.status(400).json({ error: "isActive (boolean) is required" });
      return;
    }

    if (id === req.user!.userId) {
      res.status(400).json({ error: "You cannot change your own status" });
      return;
    }

    const [user] = await db
      .update(usersTable)
      .set({ isActive })
      .where(eq(usersTable.id, id))
      .returning();

    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    await writeAudit(
      req.user!.userId,
      isActive ? "activate_user" : "deactivate_user",
      id,
      remark ?? `User ${user.username} ${isActive ? "activated" : "deactivated"}`,
    );

    res.json(await sanitizeUser(user));
  },
);

// ─── DELETE /users/:id ───────────────────────────────────────────────────────────

router.delete(
  "/users/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid user ID" }); return; }

    if (id === req.user!.userId) {
      res.status(400).json({ error: "You cannot delete your own account" });
      return;
    }

    const [user] = await db
      .select({ username: usersTable.username })
      .from(usersTable)
      .where(eq(usersTable.id, id));

    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    await db.delete(usersTable).where(eq(usersTable.id, id));

    await writeAudit(
      req.user!.userId,
      "delete_user",
      id,
      `Deleted user ${user.username}`,
    );

    res.sendStatus(204);
  },
);

export default router;

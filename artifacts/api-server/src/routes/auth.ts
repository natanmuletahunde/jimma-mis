import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, auditLogsTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { LoginBody } from "@workspace/api-zod";
import { requireAuth, signToken } from "../middlewares/auth";
import { getClientIp, getDeviceInfo } from "../lib/audit";

const router = Router();

function sanitizeUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    kebeleId: user.kebeleId,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { username, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(
      or(
        eq(usersTable.username, username),
        eq(usersTable.email, username),
      ),
    );

  if (!user || !user.isActive) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signToken({
    userId: user.id,
    username: user.username,
    role: user.role,
    kebeleId: user.kebeleId,
  });

  // Fire-and-forget audit — must not block the login response
  db.insert(auditLogsTable).values({
    userId: user.id,
    action: "login",
    entityType: "user",
    entityId: user.id,
    entityName: user.username,
    ipAddress: getClientIp(req),
    deviceInfo: getDeviceInfo(req),
    details: `Logged in as ${user.role}`,
  }).catch(() => {});

  res.json({ token, user: sanitizeUser(user) });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId));

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json(sanitizeUser(user));
});

export default router;

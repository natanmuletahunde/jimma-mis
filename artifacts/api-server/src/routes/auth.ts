import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db, usersTable, auditLogsTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { LoginBody } from "@workspace/api-zod";
import { requireAuth, signToken } from "../middlewares/auth";
import { getClientIp, getDeviceInfo } from "../lib/audit";
import { sendPasswordResetEmail } from "../lib/email";

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

router.post("/auth/logout", requireAuth, (req, res): void => {
  db.insert(auditLogsTable).values({
    userId: req.user!.userId,
    action: "logout",
    entityType: "user",
    entityId: req.user!.userId,
    entityName: req.user!.username,
    ipAddress: getClientIp(req),
    deviceInfo: getDeviceInfo(req),
    details: `Logged out (role: ${req.user!.role})`,
  }).catch(() => {});
  res.sendStatus(204);
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { username } = req.body ?? {};
  if (!username || typeof username !== "string") {
    res.status(400).json({ error: "Username is required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.username, username.trim()), eq(usersTable.email, username.trim())));

  if (!user || !user.isActive) {
    // Always return success to prevent user enumeration
    res.json({ found: false });
    return;
  }

  const maskedEmail = user.email
    ? user.email.replace(/^(.)(.*)(@.*)$/, (_, a, _b, c) => `${a}***${c}`)
    : null;
  const maskedPhone = user.phone
    ? user.phone.replace(/^(\d{3})(.*)(\d{2})$/, (_, a, _b, c) => `${a}*****${c}`)
    : null;

  // Generate a secure reset token valid for 1 hour
  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

  await db
    .update(usersTable)
    .set({ resetToken, resetTokenExpiry })
    .where(eq(usersTable.id, user.id));

  // Build reset link using the request host
  const proto = req.headers["x-forwarded-proto"] ?? (req.get("host")?.includes("localhost") ? "http" : req.secure ? "https" : "http");
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "";
  const resetLink = `${proto}://${host}/reset-password?token=${resetToken}`;

  // Send email if the user has an email address
  if (user.email) {
    sendPasswordResetEmail(user.email, user.fullName, resetLink).catch((err) => {
      req.log.error({ err }, "Failed to send password reset email");
    });
  }

  res.json({ found: true, maskedEmail, maskedPhone, fullName: user.fullName });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { token, newPassword } = req.body ?? {};

  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Reset token is required" });
    return;
  }
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.resetToken, token));

  if (!user || !user.resetTokenExpiry) {
    res.status(400).json({ error: "Invalid or expired reset link" });
    return;
  }

  if (new Date() > user.resetTokenExpiry) {
    res.status(400).json({ error: "This reset link has expired. Please request a new one." });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await db
    .update(usersTable)
    .set({ passwordHash, resetToken: null, resetTokenExpiry: null })
    .where(eq(usersTable.id, user.id));

  db.insert(auditLogsTable).values({
    userId: user.id,
    action: "password_reset",
    entityType: "user",
    entityId: user.id,
    entityName: user.username,
    ipAddress: getClientIp(req),
    deviceInfo: getDeviceInfo(req),
    details: "Password reset via email link",
  }).catch(() => {});

  res.json({ success: true });
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

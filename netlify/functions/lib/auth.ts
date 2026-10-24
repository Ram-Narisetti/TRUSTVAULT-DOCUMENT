import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { users, revokedTokens } from "../../../db/schema.js";

const JWT_SECRET = process.env.JWT_SECRET_KEY || "trustvault-production-jwt-security-key-2026";
const EMAIL_REGEX = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || typeof storedHash !== "string") return false;

  try {
    if (storedHash.startsWith("scrypt:")) {
      // Custom format: scrypt:salt:hexKey
      const parts = storedHash.split(":");
      if (parts.length === 3) {
        const [, salt, keyHex] = parts;
        const keyBuffer = Buffer.from(keyHex, "hex");
        const derived = crypto.scryptSync(password, salt, keyBuffer.length);
        return crypto.timingSafeEqual(keyBuffer, derived);
      }
      // Werkzeug format: scrypt:32768:8:1$salt$hash
      if (storedHash.includes("$")) {
        const [header, salt, keyHex] = storedHash.split("$");
        const [, n, r, p] = header.split(":").map(Number);
        const derived = crypto.scryptSync(password, salt, 64, {
          N: n || 32768,
          r: r || 8,
          p: p || 1,
          maxmem: 128 * 1024 * 1024,
        });
        const keyBuffer = Buffer.from(keyHex, "hex");
        return crypto.timingSafeEqual(keyBuffer, derived);
      }
    }
  } catch (err) {
    console.error("Error verifying password:", err);
  }
  return false;
}

export function signJwt(payload: Record<string, any>, expiresInSeconds = 7 * 24 * 3600): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiresInSeconds;
  const fullPayload = {
    ...payload,
    iat: now,
    exp,
    jti: crypto.randomUUID(),
  };

  const headerB64 = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");

  return `${headerB64}.${payloadB64}.${signature}`;
}

export function verifyJwt(token: string): Record<string, any> | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signature] = parts;
  const expectedSig = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");

  try {
    const isSigValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
    if (!isSigValid) return null;

    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function validateEmail(email: unknown): { valid: boolean; error: string } {
  if (!email || typeof email !== "string") {
    return { valid: false, error: "Email address is required." };
  }
  const trimmed = email.trim();
  if (trimmed.length > 120 || !EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: "Please enter a valid email address." };
  }
  return { valid: true, error: "" };
}

export function validateUsername(username: unknown): { valid: boolean; error: string } {
  if (!username || typeof username !== "string") {
    return { valid: false, error: "Username is required." };
  }
  const trimmed = username.trim();
  if (!USERNAME_REGEX.test(trimmed)) {
    return {
      valid: false,
      error: "Username must be 3-30 characters and contain only letters, numbers, and underscores.",
    };
  }
  return { valid: true, error: "" };
}

export function validatePasswordStrength(password: unknown): { valid: boolean; error: string } {
  if (!password || typeof password !== "string") {
    return { valid: false, error: "Password is required." };
  }
  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters long." };
  }
  if (password.length > 128) {
    return { valid: false, error: "Password cannot exceed 128 characters." };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must include at least one uppercase letter." };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Password must include at least one lowercase letter." };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must include at least one number." };
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, error: "Password must include at least one special character (!@#$%^&* etc.)." };
  }
  return { valid: true, error: "" };
}

export function toUserDict(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    full_name: user.fullName,
    role: user.role,
    is_active: user.isActive,
    avatar_url: user.avatarUrl,
    created_at: user.createdAt ? new Date(user.createdAt).toISOString() : null,
    last_login_at: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : null,
  };
}

export async function authenticateRequest(req: Request): Promise<{
  user: typeof users.$inferSelect | null;
  tokenPayload: Record<string, any> | null;
  error?: string;
  statusCode?: number;
}> {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { user: null, tokenPayload: null, error: "Authentication token is required.", statusCode: 401 };
  }

  const token = authHeader.split(" ")[1].trim();
  const payload = verifyJwt(token);
  if (!payload) {
    return { user: null, tokenPayload: null, error: "Session token is invalid or expired.", statusCode: 401 };
  }

  // Check revoked tokens
  if (payload.jti) {
    const revoked = await db.select().from(revokedTokens).where(eq(revokedTokens.jti, payload.jti)).limit(1);
    if (revoked.length > 0) {
      return { user: null, tokenPayload: null, error: "Session token has been revoked.", statusCode: 401 };
    }
  }

  const userId = Number(payload.sub);
  if (!userId) {
    return { user: null, tokenPayload: null, error: "Invalid token payload.", statusCode: 401 };
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return { user: null, tokenPayload: null, error: "User account no longer exists.", statusCode: 401 };
  }

  if (!user.isActive) {
    return {
      user: null,
      tokenPayload: null,
      error: "Your account has been deactivated. Please contact an administrator.",
      statusCode: 403,
    };
  }

  return { user, tokenPayload: payload };
}

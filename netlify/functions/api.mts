import type { Config } from "@netlify/functions";
import crypto from "node:crypto";
import { eq, and, or, desc, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  users,
  documents,
  documentPermissions,
  auditLogs,
  revokedTokens,
} from "../../db/schema.js";
import {
  hashPassword,
  verifyPassword,
  signJwt,
  validateEmail,
  validateUsername,
  validatePasswordStrength,
  toUserDict,
  authenticateRequest,
} from "./lib/auth.js";
import { logAuditEvent, toAuditLogDict } from "./lib/audit.js";
import { saveDocumentFile, getDocumentFile, deleteDocumentFile } from "./lib/storage.js";
import { ensureDefaultSeeded } from "./lib/seed.js";

const ALLOWED_CATEGORIES = [
  "Finance",
  "HR",
  "Legal",
  "Marketing",
  "Operations",
  "Other",
  "Sales",
  "Security",
  "Work",
];

const MIME_MAP: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

function json(data: any, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      ...extraHeaders,
    },
  });
}

function errorJson(message: string, status = 400) {
  return json({ error: message }, status);
}

async function serializeDoc(
  doc: typeof documents.$inferSelect,
  currentUserId?: number
): Promise<Record<string, any>> {
  const [owner] = await db.select().from(users).where(eq(users.id, doc.ownerId)).limit(1);

  const permissions = await db
    .select()
    .from(documentPermissions)
    .where(eq(documentPermissions.documentId, doc.id));

  let userPermission: string | null = null;
  if (currentUserId) {
    if (currentUserId === doc.ownerId) {
      userPermission = "OWNER";
    } else {
      const p = permissions.find((perm) => perm.userId === currentUserId);
      userPermission = p ? p.permissionLevel : null;
    }
  }

  return {
    id: doc.id,
    uuid: doc.uuid,
    owner_id: doc.ownerId,
    owner_name: owner?.fullName || null,
    owner_email: owner?.email || null,
    owner_avatar_url: owner?.avatarUrl || null,
    title: doc.title,
    original_filename: doc.originalFilename,
    file_size: doc.fileSize,
    mime_type: doc.mimeType,
    file_extension: doc.fileExtension,
    file_hash: doc.fileHash,
    category: doc.category,
    description: doc.description,
    created_at: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    updated_at: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
    shared_count: permissions.length,
    user_permission: userPermission,
  };
}

export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  // Ensure initial seed data exists
  await ensureDefaultSeeded();

  const url = new URL(req.url);
  const pathname = url.pathname.replace(/\/+$/, "");
  const method = req.method.toUpperCase();
  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("client-ip") || null;
  const userAgent = req.headers.get("user-agent") || null;

  try {
    // ==========================================
    // 1. AUTH: REGISTER
    // ==========================================
    if (method === "POST" && pathname === "/api/auth/register") {
      const body = await req.json().catch(() => ({}));
      const { full_name, username, email, password } = body;

      const vEmail = validateEmail(email);
      if (!vEmail.valid) return errorJson(vEmail.error, 400);

      const vUser = validateUsername(username);
      if (!vUser.valid) return errorJson(vUser.error, 400);

      if (!full_name || typeof full_name !== "string" || full_name.trim().length < 2 || full_name.trim().length > 120) {
        return errorJson("Full name must be between 2 and 120 characters.", 400);
      }

      const vPass = validatePasswordStrength(password);
      if (!vPass.valid) return errorJson(vPass.error, 400);

      const cleanEmail = email.trim().toLowerCase();
      const cleanUsername = username.trim().toLowerCase();

      // Check existing
      const existing = await db
        .select()
        .from(users)
        .where(or(eq(users.email, cleanEmail), eq(users.username, cleanUsername)))
        .limit(1);

      if (existing.length > 0) {
        return errorJson("An account with these credentials already exists.", 400);
      }

      const passwordHash = hashPassword(password);
      const [newUser] = await db
        .insert(users)
        .values({
          email: cleanEmail,
          username: cleanUsername,
          fullName: full_name.trim(),
          role: "owner",
          isActive: true,
          passwordHash,
        })
        .returning();

      await logAuditEvent({
        action: "AUTH_REGISTER",
        actorId: newUser.id,
        actorEmail: newUser.email,
        resourceType: "User",
        resourceId: newUser.id,
        status: "SUCCESS",
        ipAddress: clientIp,
        userAgent,
        details: { email: newUser.email, role: newUser.role },
      });

      const token = signJwt({
        sub: newUser.id,
        email: newUser.email,
        role: newUser.role,
      });

      return json({ user: toUserDict(newUser), token }, 201);
    }

    // ==========================================
    // 2. AUTH: LOGIN
    // ==========================================
    if (method === "POST" && pathname === "/api/auth/login") {
      const body = await req.json().catch(() => ({}));
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const password = typeof body.password === "string" ? body.password : "";

      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

      if (!user) {
        await logAuditEvent({
          action: "AUTH_LOGIN_FAILED",
          actorEmail: email,
          resourceType: "Auth",
          resourceId: email,
          status: "FAILURE",
          ipAddress: clientIp,
          userAgent,
          details: "Attempted login with non-existent email.",
        });
        return errorJson("Invalid email or password.", 401);
      }

      if (!user.isActive) {
        await logAuditEvent({
          action: "AUTH_LOGIN_FAILED",
          actorId: user.id,
          actorEmail: user.email,
          resourceType: "Auth",
          resourceId: user.id,
          status: "DENIED",
          ipAddress: clientIp,
          userAgent,
          details: "Deactivated user attempted login.",
        });
        return errorJson("Your account has been deactivated. Please contact an administrator.", 403);
      }

      const isPasswordValid = verifyPassword(password, user.passwordHash);
      if (!isPasswordValid) {
        await logAuditEvent({
          action: "AUTH_LOGIN_FAILED",
          actorId: user.id,
          actorEmail: user.email,
          resourceType: "Auth",
          resourceId: user.id,
          status: "FAILURE",
          ipAddress: clientIp,
          userAgent,
          details: "Incorrect password provided.",
        });
        return errorJson("Invalid email or password.", 401);
      }

      await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

      await logAuditEvent({
        action: "AUTH_LOGIN_SUCCESS",
        actorId: user.id,
        actorEmail: user.email,
        resourceType: "Auth",
        resourceId: user.id,
        status: "SUCCESS",
        ipAddress: clientIp,
        userAgent,
      });

      const token = signJwt({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      return json({ user: toUserDict(user), token }, 200);
    }

    // ==========================================
    // 3. AUTH: LOGOUT
    // ==========================================
    if (method === "POST" && pathname === "/api/auth/logout") {
      const auth = await authenticateRequest(req);
      if (!auth.user || !auth.tokenPayload) {
        return errorJson(auth.error || "Unauthorized", auth.statusCode || 401);
      }

      if (auth.tokenPayload.jti) {
        const exp = auth.tokenPayload.exp
          ? new Date(auth.tokenPayload.exp * 1000)
          : new Date(Date.now() + 7 * 24 * 3600 * 1000);

        await db.insert(revokedTokens).values({
          jti: auth.tokenPayload.jti,
          userId: auth.user.id,
          expiresAt: exp,
        });
      }

      await logAuditEvent({
        action: "AUTH_LOGOUT",
        actorId: auth.user.id,
        actorEmail: auth.user.email,
        resourceType: "Auth",
        resourceId: auth.user.id,
        status: "SUCCESS",
        ipAddress: clientIp,
        userAgent,
      });

      return json({ message: "Successfully logged out." }, 200);
    }

    // ==========================================
    // 4. AUTH: ME
    // ==========================================
    if (method === "GET" && pathname === "/api/auth/me") {
      const auth = await authenticateRequest(req);
      if (!auth.user) return errorJson(auth.error || "Unauthorized", auth.statusCode || 401);
      return json({ user: toUserDict(auth.user) }, 200);
    }

    // ==========================================
    // 5. AUTH: UPDATE PROFILE
    // ==========================================
    if (method === "PUT" && pathname === "/api/auth/profile") {
      const auth = await authenticateRequest(req);
      if (!auth.user) return errorJson(auth.error || "Unauthorized", auth.statusCode || 401);

      const body = await req.json().catch(() => ({}));
      const updates: Partial<typeof users.$inferInsert> = {};

      if (body.full_name !== undefined) {
        const name = String(body.full_name).trim();
        if (!name) return errorJson("Full name cannot be empty.", 400);
        updates.fullName = name;
      }

      if (body.avatar_url !== undefined) {
        updates.avatarUrl = body.avatar_url;
      }

      updates.updatedAt = new Date();

      const [updated] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, auth.user.id))
        .returning();

      await logAuditEvent({
        action: "PROFILE_UPDATED",
        actorId: auth.user.id,
        actorEmail: auth.user.email,
        resourceType: "User",
        resourceId: auth.user.id,
        status: "SUCCESS",
        ipAddress: clientIp,
        userAgent,
        details: "User updated profile information.",
      });

      return json({ message: "Profile updated successfully.", user: toUserDict(updated) }, 200);
    }

    // ==========================================
    // 6. AUTH: AVATAR
    // ==========================================
    if (pathname === "/api/auth/avatar") {
      const auth = await authenticateRequest(req);
      if (!auth.user) return errorJson(auth.error || "Unauthorized", auth.statusCode || 401);

      if (method === "POST") {
        let avatarDataUrl: string | null = null;
        const contentType = req.headers.get("content-type") || "";

        if (contentType.includes("multipart/form-data")) {
          const formData = await req.formData();
          const file = formData.get("avatar") as File | null;
          if (!file || !file.name) {
            return errorJson("No file selected.", 400);
          }
          if (file.size > 2 * 1024 * 1024) {
            return errorJson("Avatar image must be smaller than 2 MB.", 400);
          }
          const buffer = Buffer.from(await file.arrayBuffer());
          const b64 = buffer.toString("base64");
          const mime = file.type || "image/jpeg";
          avatarDataUrl = `data:${mime};base64,${b64}`;
        } else {
          const body = await req.json().catch(() => ({}));
          avatarDataUrl = body.avatar || null;
        }

        if (!avatarDataUrl) {
          return errorJson("No avatar image provided.", 400);
        }

        const [updated] = await db
          .update(users)
          .set({ avatarUrl: avatarDataUrl, updatedAt: new Date() })
          .where(eq(users.id, auth.user.id))
          .returning();

        await logAuditEvent({
          action: "AVATAR_UPDATED",
          actorId: auth.user.id,
          actorEmail: auth.user.email,
          resourceType: "User",
          resourceId: auth.user.id,
          status: "SUCCESS",
          ipAddress: clientIp,
          userAgent,
          details: "User updated profile avatar.",
        });

        return json({ message: "Profile photo updated successfully.", user: toUserDict(updated) }, 200);
      }

      if (method === "DELETE") {
        const [updated] = await db
          .update(users)
          .set({ avatarUrl: null, updatedAt: new Date() })
          .where(eq(users.id, auth.user.id))
          .returning();

        await logAuditEvent({
          action: "AVATAR_REMOVED",
          actorId: auth.user.id,
          actorEmail: auth.user.email,
          resourceType: "User",
          resourceId: auth.user.id,
          status: "SUCCESS",
          ipAddress: clientIp,
          userAgent,
          details: "User removed profile photo.",
        });

        return json({ message: "Profile photo removed.", user: toUserDict(updated) }, 200);
      }
    }

    // ==========================================
    // 7. AUTH: PASSWORD CHANGE
    // ==========================================
    if (method === "PUT" && pathname === "/api/auth/password") {
      const auth = await authenticateRequest(req);
      if (!auth.user) return errorJson(auth.error || "Unauthorized", auth.statusCode || 401);

      const body = await req.json().catch(() => ({}));
      const { current_password, new_password } = body;

      if (!verifyPassword(current_password || "", auth.user.passwordHash)) {
        await logAuditEvent({
          action: "PASSWORD_CHANGE",
          actorId: auth.user.id,
          actorEmail: auth.user.email,
          resourceType: "User",
          resourceId: auth.user.id,
          status: "FAILURE",
          ipAddress: clientIp,
          userAgent,
          details: "Incorrect current password provided.",
        });
        return errorJson("Current password does not match.", 400);
      }

      const vPass = validatePasswordStrength(new_password);
      if (!vPass.valid) return errorJson(vPass.error, 400);

      const newHash = hashPassword(new_password);
      await db
        .update(users)
        .set({ passwordHash: newHash, updatedAt: new Date() })
        .where(eq(users.id, auth.user.id));

      await logAuditEvent({
        action: "PASSWORD_CHANGE",
        actorId: auth.user.id,
        actorEmail: auth.user.email,
        resourceType: "User",
        resourceId: auth.user.id,
        status: "SUCCESS",
        ipAddress: clientIp,
        userAgent,
      });

      return json({ message: "Password updated successfully." }, 200);
    }

    // ==========================================
    // 8. SYSTEM: CATEGORIES
    // ==========================================
    if (method === "GET" && pathname === "/api/system/categories") {
      return json({ categories: ALLOWED_CATEGORIES }, 200);
    }

    // ==========================================
    // 9. SYSTEM: ADMIN STATS
    // ==========================================
    if (method === "GET" && pathname === "/api/system/stats") {
      const auth = await authenticateRequest(req);
      if (!auth.user) return errorJson(auth.error || "Unauthorized", auth.statusCode || 401);
      if (auth.user.role !== "admin") return errorJson("Forbidden", 403);

      const allUsers = await db.select().from(users);
      const total_users = allUsers.length;
      const active_users = allUsers.filter((u) => u.isActive).length;
      const deactivated_users = total_users - active_users;

      const allDocs = await db.select().from(documents);
      const total_documents = allDocs.length;
      const storage_bytes = allDocs.reduce((sum, d) => sum + (d.fileSize || 0), 0);

      const allPerms = await db.select().from(documentPermissions);
      const total_shares = allPerms.length;

      const allAudits = await db.select().from(auditLogs);
      const total_audits = allAudits.length;
      const denied_attempts = allAudits.filter((a) => a.status === "DENIED").length;

      const role_breakdown = {
        admin: allUsers.filter((u) => u.role === "admin").length,
        owner: allUsers.filter((u) => u.role === "owner").length,
        viewer: allUsers.filter((u) => u.role === "viewer").length,
      };

      const recentEvents = await db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.timestamp))
        .limit(6);

      return json({
        total_users,
        active_users,
        deactivated_users,
        total_documents,
        total_shares,
        total_audits,
        denied_attempts,
        storage_bytes,
        role_breakdown,
        recent_activity: recentEvents.map(toAuditLogDict),
      });
    }

    // ==========================================
    // 10. SYSTEM: OWNER STATS
    // ==========================================
    if (method === "GET" && pathname === "/api/system/owner-stats") {
      const auth = await authenticateRequest(req);
      if (!auth.user) return errorJson(auth.error || "Unauthorized", auth.statusCode || 401);

      const myDocs = await db
        .select()
        .from(documents)
        .where(eq(documents.ownerId, auth.user.id))
        .orderBy(desc(documents.createdAt));

      const my_documents_count = myDocs.length;
      const storage_bytes = myDocs.reduce((sum, d) => sum + (d.fileSize || 0), 0);

      const myDocIds = myDocs.map((d) => d.id);
      let shared_out_count = 0;
      if (myDocIds.length > 0) {
        const outPerms = await db
          .select()
          .from(documentPermissions)
          .where(inArray(documentPermissions.documentId, myDocIds));
        shared_out_count = outPerms.length;
      }

      const inPerms = await db
        .select()
        .from(documentPermissions)
        .where(eq(documentPermissions.userId, auth.user.id));
      const shared_with_me_count = inPerms.length;

      const recentDocs = myDocs.slice(0, 5);
      const recent_uploads = await Promise.all(
        recentDocs.map((doc) => serializeDoc(doc, auth.user!.id))
      );

      return json({
        my_documents_count,
        storage_bytes,
        shared_out_count,
        shared_with_me_count,
        recent_uploads,
      });
    }

    // ==========================================
    // 11. AUDIT: SYSTEM LOGS (Admin only)
    // ==========================================
    if (method === "GET" && pathname === "/api/audit/system") {
      const auth = await authenticateRequest(req);
      if (!auth.user) return errorJson(auth.error || "Unauthorized", auth.statusCode || 401);
      if (auth.user.role !== "admin") return errorJson("Forbidden", 403);

      const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
      const perPage = Math.max(1, Number(url.searchParams.get("per_page")) || 20);
      const action = url.searchParams.get("action");
      const status = url.searchParams.get("status");
      const search = url.searchParams.get("search");

      let logs = await db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.timestamp));

      if (action) {
        logs = logs.filter((l) => l.action.toLowerCase() === action.toLowerCase());
      }
      if (status) {
        logs = logs.filter((l) => l.status.toLowerCase() === status.toLowerCase());
      }
      if (search) {
        const q = search.toLowerCase();
        logs = logs.filter(
          (l) =>
            l.action.toLowerCase().includes(q) ||
            (l.actorEmail && l.actorEmail.toLowerCase().includes(q)) ||
            (l.resourceType && l.resourceType.toLowerCase().includes(q)) ||
            (l.details && l.details.toLowerCase().includes(q))
        );
      }

      const total = logs.length;
      const total_pages = Math.ceil(total / perPage) || 1;
      const paginated = logs.slice((page - 1) * perPage, page * perPage);

      return json({
        logs: paginated.map(toAuditLogDict),
        total,
        page,
        per_page: perPage,
        total_pages,
      });
    }

    // ==========================================
    // 12. AUDIT: MY DOCUMENTS LOGS
    // ==========================================
    if (method === "GET" && pathname === "/api/audit/my-documents") {
      const auth = await authenticateRequest(req);
      if (!auth.user) return errorJson(auth.error || "Unauthorized", auth.statusCode || 401);

      const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
      const perPage = Math.max(1, Number(url.searchParams.get("per_page")) || 20);

      const myDocs = await db
        .select({ id: documents.id })
        .from(documents)
        .where(eq(documents.ownerId, auth.user.id));
      const myDocIds = new Set(myDocs.map((d) => String(d.id)));

      const allLogs = await db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp));
      const scopedLogs = allLogs.filter(
        (l) =>
          l.actorId === auth.user!.id ||
          (l.resourceType === "Document" && l.resourceId && myDocIds.has(String(l.resourceId)))
      );

      const total = scopedLogs.length;
      const total_pages = Math.ceil(total / perPage) || 1;
      const paginated = scopedLogs.slice((page - 1) * perPage, page * perPage);

      return json({
        logs: paginated.map(toAuditLogDict),
        total,
        page,
        per_page: perPage,
        total_pages,
      });
    }

    // ==========================================
    // 13. USERS MANAGEMENT (Admin only)
    // ==========================================
    if (method === "GET" && pathname === "/api/users") {
      const auth = await authenticateRequest(req);
      if (!auth.user) return errorJson(auth.error || "Unauthorized", auth.statusCode || 401);
      if (auth.user.role !== "admin") return errorJson("Forbidden", 403);

      const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
      const perPage = Math.max(1, Number(url.searchParams.get("per_page")) || 20);
      const search = url.searchParams.get("search");
      const role = url.searchParams.get("role");
      const isActiveParam = url.searchParams.get("is_active");

      let allUsers = await db.select().from(users).orderBy(desc(users.createdAt));

      if (search) {
        const q = search.toLowerCase();
        allUsers = allUsers.filter(
          (u) =>
            u.fullName.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            u.username.toLowerCase().includes(q)
        );
      }
      if (role) {
        allUsers = allUsers.filter((u) => u.role.toLowerCase() === role.toLowerCase());
      }
      if (isActiveParam !== null && isActiveParam !== undefined) {
        const isActiveBool = isActiveParam.toLowerCase() === "true" || isActiveParam === "1";
        allUsers = allUsers.filter((u) => u.isActive === isActiveBool);
      }

      const total = allUsers.length;
      const total_pages = Math.ceil(total / perPage) || 1;
      const paginated = allUsers.slice((page - 1) * perPage, page * perPage);

      return json({
        users: paginated.map(toUserDict),
        total,
        page,
        per_page: perPage,
        total_pages,
      });
    }

    // Toggle User Status
    const userStatusMatch = pathname.match(/^\/api\/users\/(\d+)\/status$/);
    if (method === "PUT" && userStatusMatch) {
      const auth = await authenticateRequest(req);
      if (!auth.user) return errorJson(auth.error || "Unauthorized", auth.statusCode || 401);
      if (auth.user.role !== "admin") return errorJson("Forbidden", 403);

      const targetId = Number(userStatusMatch[1]);
      if (targetId === auth.user.id) {
        return errorJson("Cannot modify your own active status.", 400);
      }

      const [targetUser] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
      if (!targetUser) return errorJson("User not found.", 404);

      const newStatus = !targetUser.isActive;
      const [updated] = await db
        .update(users)
        .set({ isActive: newStatus, updatedAt: new Date() })
        .where(eq(users.id, targetId))
        .returning();

      await logAuditEvent({
        action: newStatus ? "USER_ACTIVATED" : "USER_DEACTIVATED",
        actorId: auth.user.id,
        actorEmail: auth.user.email,
        resourceType: "User",
        resourceId: targetId,
        status: "SUCCESS",
        ipAddress: clientIp,
        userAgent,
        details: `Admin toggled user ${targetUser.email} active status to ${newStatus}`,
      });

      return json({
        message: `User status successfully updated to ${newStatus ? "active" : "deactivated"}.`,
        user: toUserDict(updated),
      });
    }

    // ==========================================
    // 14. SHARING RECIPIENTS SEARCH
    // ==========================================
    if (method === "GET" && pathname === "/api/sharing/recipients") {
      const auth = await authenticateRequest(req);
      if (!auth.user) return errorJson(auth.error || "Unauthorized", auth.statusCode || 401);

      const q = (url.searchParams.get("q") || "").toLowerCase().trim();
      let activeUsers = await db
        .select()
        .from(users)
        .where(eq(users.isActive, true))
        .limit(20);

      activeUsers = activeUsers.filter((u) => u.id !== auth.user!.id);
      if (q) {
        activeUsers = activeUsers.filter(
          (u) =>
            u.fullName.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            u.username.toLowerCase().includes(q)
        );
      }

      const mapped = activeUsers.map((u) => ({
        id: u.id,
        full_name: u.fullName,
        email: u.email,
        role: u.role,
        avatar_url: u.avatarUrl,
      }));

      return json({ users: mapped });
    }

    // ==========================================
    // 15. DOCUMENTS: UPLOAD
    // ==========================================
    if (method === "POST" && pathname === "/api/documents/upload") {
      const auth = await authenticateRequest(req);
      if (!auth.user) return errorJson(auth.error || "Unauthorized", auth.statusCode || 401);

      if (auth.user.role === "viewer") {
        return errorJson("Viewers are not permitted to upload documents.", 403);
      }

      const formData = await req.formData().catch(() => null);
      if (!formData) return errorJson("Invalid form data.", 400);

      const file = formData.get("file") as File | null;
      if (!file || !file.name) {
        return errorJson("No file uploaded in form data.", 400);
      }

      const titleInput = (formData.get("title") as string) || file.name;
      const categoryInput = (formData.get("category") as string) || "Other";
      const descriptionInput = (formData.get("description") as string) || "";

      const originalFilename = file.name;
      const ext = originalFilename.includes(".")
        ? originalFilename.split(".").pop()!.toLowerCase()
        : "";

      const dangerousExts = ["exe", "bat", "sh", "cmd", "msi", "vbs", "ps1", "scr"];
      if (dangerousExts.includes(ext)) {
        return errorJson("File type not allowed.", 400);
      }

      const mimeType = file.type || MIME_MAP[ext] || "application/octet-stream";
      const fileBytes = Buffer.from(await file.arrayBuffer());

      if (fileBytes.length > 50 * 1024 * 1024) {
        return errorJson("File size exceeds 50MB limit.", 400);
      }

      const fileUuid = crypto.randomUUID();
      const safeFilename = originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storageFilename = `${fileUuid}_${safeFilename}`;
      const fileHash = crypto.createHash("sha256").update(fileBytes).digest("hex");

      await saveDocumentFile(storageFilename, fileBytes);

      const [newDoc] = await db
        .insert(documents)
        .values({
          uuid: fileUuid,
          ownerId: auth.user.id,
          title: titleInput.trim(),
          originalFilename,
          storageFilename,
          fileSize: fileBytes.length,
          mimeType,
          fileExtension: ext,
          fileHash,
          category: ALLOWED_CATEGORIES.includes(categoryInput) ? categoryInput : "Other",
          description: descriptionInput.trim(),
        })
        .returning();

      await logAuditEvent({
        action: "DOCUMENT_UPLOAD",
        actorId: auth.user.id,
        actorEmail: auth.user.email,
        resourceType: "Document",
        resourceId: newDoc.id,
        status: "SUCCESS",
        ipAddress: clientIp,
        userAgent,
        details: { filename: originalFilename, size: fileBytes.length, hash: fileHash },
      });

      const serialized = await serializeDoc(newDoc, auth.user.id);
      return json({ document: serialized }, 201);
    }

    // ==========================================
    // 16. DOCUMENTS: SEARCH
    // ==========================================
    if (method === "GET" && pathname === "/api/documents/search") {
      const auth = await authenticateRequest(req);
      if (!auth.user) return errorJson(auth.error || "Unauthorized", auth.statusCode || 401);

      const q = (url.searchParams.get("q") || "").toLowerCase().trim();

      // Find documents accessible by user (owned or shared)
      const owned = await db
        .select()
        .from(documents)
        .where(eq(documents.ownerId, auth.user.id));

      const sharedPerms = await db
        .select()
        .from(documentPermissions)
        .where(eq(documentPermissions.userId, auth.user.id));
      const sharedDocIds = sharedPerms.map((p) => p.documentId);

      let sharedDocs: typeof documents.$inferSelect[] = [];
      if (sharedDocIds.length > 0) {
        sharedDocs = await db
          .select()
          .from(documents)
          .where(inArray(documents.id, sharedDocIds));
      }

      const docMap = new Map<number, typeof documents.$inferSelect>();
      for (const d of owned) docMap.set(d.id, d);
      for (const d of sharedDocs) docMap.set(d.id, d);

      let docList = Array.from(docMap.values());
      if (q) {
        docList = docList.filter(
          (d) =>
            d.title.toLowerCase().includes(q) ||
            d.originalFilename.toLowerCase().includes(q) ||
            d.category.toLowerCase().includes(q) ||
            (d.description && d.description.toLowerCase().includes(q))
        );
      }

      const results = await Promise.all(docList.map((d) => serializeDoc(d, auth.user!.id)));
      return json({ documents: results });
    }

    // ==========================================
    // 17. DOCUMENTS: SHARED WITH ME
    // ==========================================
    if (method === "GET" && pathname === "/api/documents/shared") {
      const auth = await authenticateRequest(req);
      if (!auth.user) return errorJson(auth.error || "Unauthorized", auth.statusCode || 401);

      const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
      const perPage = Math.max(1, Number(url.searchParams.get("per_page")) || 20);
      const search = url.searchParams.get("search");
      const category = url.searchParams.get("category");
      const fileType = url.searchParams.get("file_type");

      const perms = await db
        .select()
        .from(documentPermissions)
        .where(eq(documentPermissions.userId, auth.user.id));
      const docIds = perms.map((p) => p.documentId);

      let docList: typeof documents.$inferSelect[] = [];
      if (docIds.length > 0) {
        docList = await db
          .select()
          .from(documents)
          .where(inArray(documents.id, docIds))
          .orderBy(desc(documents.createdAt));
      }

      if (search) {
        const q = search.toLowerCase();
        docList = docList.filter(
          (d) =>
            d.title.toLowerCase().includes(q) ||
            d.originalFilename.toLowerCase().includes(q) ||
            (d.description && d.description.toLowerCase().includes(q))
        );
      }
      if (category) {
        docList = docList.filter((d) => d.category.toLowerCase() === category.toLowerCase());
      }
      if (fileType) {
        docList = docList.filter((d) => d.fileExtension.toLowerCase() === fileType.toLowerCase());
      }

      const total = docList.length;
      const total_pages = Math.ceil(total / perPage) || 1;
      const paginated = docList.slice((page - 1) * perPage, page * perPage);
      const results = await Promise.all(paginated.map((d) => serializeDoc(d, auth.user!.id)));

      return json({
        documents: results,
        total,
        page,
        per_page: perPage,
        total_pages,
      });
    }

    // ==========================================
    // 18. DOCUMENTS: LIST OWNED (OR ALL IF ADMIN)
    // ==========================================
    if (method === "GET" && pathname === "/api/documents") {
      const auth = await authenticateRequest(req);
      if (!auth.user) return errorJson(auth.error || "Unauthorized", auth.statusCode || 401);

      const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
      const perPage = Math.max(1, Number(url.searchParams.get("per_page")) || 20);
      const search = url.searchParams.get("search");
      const category = url.searchParams.get("category");
      const fileType = url.searchParams.get("file_type");
      const sortBy = url.searchParams.get("sort_by") || "created_at";
      const sortOrder = url.searchParams.get("sort_order") || "desc";

      let docList = await db
        .select()
        .from(documents)
        .where(eq(documents.ownerId, auth.user.id));

      if (search) {
        const q = search.toLowerCase();
        docList = docList.filter(
          (d) =>
            d.title.toLowerCase().includes(q) ||
            d.originalFilename.toLowerCase().includes(q) ||
            (d.description && d.description.toLowerCase().includes(q))
        );
      }
      if (category) {
        docList = docList.filter((d) => d.category.toLowerCase() === category.toLowerCase());
      }
      if (fileType) {
        docList = docList.filter((d) => d.fileExtension.toLowerCase() === fileType.toLowerCase());
      }

      // Sort
      docList.sort((a, b) => {
        let valA: any = a.createdAt;
        let valB: any = b.createdAt;
        if (sortBy === "title") {
          valA = a.title.toLowerCase();
          valB = b.title.toLowerCase();
        } else if (sortBy === "file_size") {
          valA = a.fileSize;
          valB = b.fileSize;
        }
        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });

      const total = docList.length;
      const total_pages = Math.ceil(total / perPage) || 1;
      const paginated = docList.slice((page - 1) * perPage, page * perPage);
      const results = await Promise.all(paginated.map((d) => serializeDoc(d, auth.user!.id)));

      return json({
        documents: results,
        total,
        page,
        per_page: perPage,
        total_pages,
      });
    }

    // ==========================================
    // 19. DOCUMENTS: SINGLE / PREVIEW / DOWNLOAD / PERMISSIONS
    // ==========================================
    const docMatch = pathname.match(/^\/api\/documents\/(\d+)(\/(preview|download|permissions(\/(\d+))?))?$/);
    if (docMatch) {
      const docId = Number(docMatch[1]);
      const subAction = docMatch[3]; // preview, download, permissions, permissions/123
      const targetUserId = docMatch[5] ? Number(docMatch[5]) : null;

      const auth = await authenticateRequest(req);
      if (!auth.user) return errorJson(auth.error || "Unauthorized", auth.statusCode || 401);

      const [doc] = await db.select().from(documents).where(eq(documents.id, docId)).limit(1);
      if (!doc) return errorJson("Document not found.", 404);

      // Check permission
      const isOwner = doc.ownerId === auth.user.id;
      const isAdmin = auth.user.role === "admin";
      const [perm] = await db
        .select()
        .from(documentPermissions)
        .where(
          and(
            eq(documentPermissions.documentId, doc.id),
            eq(documentPermissions.userId, auth.user.id)
          )
        )
        .limit(1);

      const canView = isOwner || isAdmin || !!perm;
      const canEdit = isOwner || isAdmin || perm?.permissionLevel === "EDIT";

      // PREVIEW
      if (subAction === "preview" && method === "GET") {
        if (!canView) {
          await logAuditEvent({
            action: "ACCESS_DENIED",
            actorId: auth.user.id,
            actorEmail: auth.user.email,
            resourceType: "Document",
            resourceId: doc.id,
            status: "DENIED",
            ipAddress: clientIp,
            userAgent,
            details: "Unauthorized document preview attempt.",
          });
          return errorJson("You do not have permission to preview this document.", 403);
        }

        const fileBuffer = await getDocumentFile(doc.storageFilename);
        if (!fileBuffer) {
          return errorJson("File could not be retrieved.", 404);
        }

        await logAuditEvent({
          action: "DOCUMENT_PREVIEW",
          actorId: auth.user.id,
          actorEmail: auth.user.email,
          resourceType: "Document",
          resourceId: doc.id,
          status: "SUCCESS",
          ipAddress: clientIp,
          userAgent,
          details: { original_filename: doc.originalFilename, size: doc.fileSize },
        });

        return new Response(fileBuffer, {
          status: 200,
          headers: {
            "Content-Type": doc.mimeType,
            "X-Content-Type-Options": "nosniff",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      // DOWNLOAD
      if (subAction === "download" && method === "GET") {
        if (!canView) {
          await logAuditEvent({
            action: "ACCESS_DENIED",
            actorId: auth.user.id,
            actorEmail: auth.user.email,
            resourceType: "Document",
            resourceId: doc.id,
            status: "DENIED",
            ipAddress: clientIp,
            userAgent,
            details: "Unauthorized document download attempt.",
          });
          return errorJson("You do not have permission to download this document.", 403);
        }

        const fileBuffer = await getDocumentFile(doc.storageFilename);
        if (!fileBuffer) {
          return errorJson("File could not be retrieved.", 404);
        }

        await logAuditEvent({
          action: "DOCUMENT_DOWNLOAD",
          actorId: auth.user.id,
          actorEmail: auth.user.email,
          resourceType: "Document",
          resourceId: doc.id,
          status: "SUCCESS",
          ipAddress: clientIp,
          userAgent,
          details: { original_filename: doc.originalFilename, size: doc.fileSize },
        });

        return new Response(fileBuffer, {
          status: 200,
          headers: {
            "Content-Type": doc.mimeType,
            "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.originalFilename)}"`,
            "X-Content-Type-Options": "nosniff",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      // PERMISSIONS LIST
      if (subAction === "permissions" && method === "GET") {
        if (!isOwner && !isAdmin) {
          return errorJson("Only the owner or an administrator can view permissions.", 403);
        }

        const grants = await db
          .select({
            id: documentPermissions.id,
            documentId: documentPermissions.documentId,
            userId: documentPermissions.userId,
            permissionLevel: documentPermissions.permissionLevel,
            grantedById: documentPermissions.grantedById,
            createdAt: documentPermissions.createdAt,
            updatedAt: documentPermissions.updatedAt,
            userName: users.fullName,
            userEmail: users.email,
            userAvatarUrl: users.avatarUrl,
          })
          .from(documentPermissions)
          .innerJoin(users, eq(documentPermissions.userId, users.id))
          .where(eq(documentPermissions.documentId, doc.id));

        const mapped = grants.map((g) => ({
          id: g.id,
          document_id: g.documentId,
          user_id: g.userId,
          user_name: g.userName,
          user_email: g.userEmail,
          user_avatar_url: g.userAvatarUrl,
          permission_level: g.permissionLevel,
          granted_by_id: g.grantedById,
          created_at: g.createdAt ? new Date(g.createdAt).toISOString() : null,
          updated_at: g.updatedAt ? new Date(g.updatedAt).toISOString() : null,
        }));

        return json({ permissions: mapped });
      }

      // GRANT PERMISSION
      if (subAction === "permissions" && method === "POST") {
        if (!isOwner && !isAdmin) {
          return errorJson("Only the owner or an administrator can grant access permissions.", 403);
        }

        const body = await req.json().catch(() => ({}));
        let targetId = body.user_id ? Number(body.user_id) : null;
        const level = (body.permission_level || "VIEW").toUpperCase();

        if (level !== "VIEW" && level !== "EDIT") {
          return errorJson("Invalid permission level. Must be VIEW or EDIT.", 400);
        }

        if (!targetId && body.email) {
          const [found] = await db
            .select()
            .from(users)
            .where(eq(users.email, String(body.email).trim().toLowerCase()))
            .limit(1);
          if (found) targetId = found.id;
        }

        if (!targetId) {
          return errorJson("Target user could not be found.", 400);
        }

        if (targetId === doc.ownerId) {
          return errorJson("Cannot grant permission to the document owner.", 400);
        }

        const [existing] = await db
          .select()
          .from(documentPermissions)
          .where(
            and(
              eq(documentPermissions.documentId, doc.id),
              eq(documentPermissions.userId, targetId)
            )
          )
          .limit(1);

        let permRecord;
        if (existing) {
          const [updated] = await db
            .update(documentPermissions)
            .set({ permissionLevel: level, updatedAt: new Date(), grantedById: auth.user.id })
            .where(eq(documentPermissions.id, existing.id))
            .returning();
          permRecord = updated;
        } else {
          const [created] = await db
            .insert(documentPermissions)
            .values({
              documentId: doc.id,
              userId: targetId,
              permissionLevel: level,
              grantedById: auth.user.id,
            })
            .returning();
          permRecord = created;
        }

        await logAuditEvent({
          action: "PERMISSION_GRANTED",
          actorId: auth.user.id,
          actorEmail: auth.user.email,
          resourceType: "DocumentPermission",
          resourceId: permRecord.id,
          status: "SUCCESS",
          ipAddress: clientIp,
          userAgent,
          details: { document_id: doc.id, target_user_id: targetId, level },
        });

        return json(
          {
            permission: {
              id: permRecord.id,
              document_id: permRecord.documentId,
              user_id: permRecord.userId,
              permission_level: permRecord.permissionLevel,
              granted_by_id: permRecord.grantedById,
              created_at: permRecord.createdAt ? new Date(permRecord.createdAt).toISOString() : null,
              updated_at: permRecord.updatedAt ? new Date(permRecord.updatedAt).toISOString() : null,
            },
            message: "Access permission granted successfully.",
          },
          201
        );
      }

      // REVOKE PERMISSION
      if (subAction?.startsWith("permissions") && method === "DELETE" && targetUserId) {
        if (!isOwner && !isAdmin) {
          return errorJson("Only the document owner or an administrator can revoke access.", 403);
        }

        await db
          .delete(documentPermissions)
          .where(
            and(
              eq(documentPermissions.documentId, doc.id),
              eq(documentPermissions.userId, targetUserId)
            )
          );

        await logAuditEvent({
          action: "PERMISSION_REVOKED",
          actorId: auth.user.id,
          actorEmail: auth.user.email,
          resourceType: "DocumentPermission",
          resourceId: `${doc.id}:${targetUserId}`,
          status: "SUCCESS",
          ipAddress: clientIp,
          userAgent,
          details: `Revoked access for user ${targetUserId} on document ${doc.id}`,
        });

        return json({ message: "Permission revoked successfully. Access has been immediately terminated." });
      }

      // GET SINGLE DOCUMENT DETAILS
      if (!subAction && method === "GET") {
        if (!canView) {
          await logAuditEvent({
            action: "ACCESS_DENIED",
            actorId: auth.user.id,
            actorEmail: auth.user.email,
            resourceType: "Document",
            resourceId: doc.id,
            status: "DENIED",
            ipAddress: clientIp,
            userAgent,
            details: "Unauthorized document view attempt.",
          });
          return errorJson("You do not have permission to view this document.", 403);
        }

        const serialized = await serializeDoc(doc, auth.user.id);
        return json({ document: serialized });
      }

      // UPDATE DOCUMENT METADATA
      if (!subAction && method === "PUT") {
        if (!canEdit) {
          return errorJson("You do not have permission to edit this document.", 403);
        }

        const body = await req.json().catch(() => ({}));
        const updates: Partial<typeof documents.$inferInsert> = {};

        if (body.title !== undefined) {
          const t = String(body.title).trim();
          if (!t) return errorJson("Document title cannot be empty.", 400);
          updates.title = t;
        }

        if (body.category !== undefined) {
          updates.category = ALLOWED_CATEGORIES.includes(body.category) ? body.category : "Other";
        }

        if (body.description !== undefined) {
          updates.description = String(body.description).trim();
        }

        updates.updatedAt = new Date();

        const [updated] = await db
          .update(documents)
          .set(updates)
          .where(eq(documents.id, doc.id))
          .returning();

        await logAuditEvent({
          action: "DOCUMENT_METADATA_UPDATED",
          actorId: auth.user.id,
          actorEmail: auth.user.email,
          resourceType: "Document",
          resourceId: doc.id,
          status: "SUCCESS",
          ipAddress: clientIp,
          userAgent,
          details: "Updated document title/category/description.",
        });

        const serialized = await serializeDoc(updated, auth.user.id);
        return json({ document: serialized });
      }

      // DELETE DOCUMENT
      if (!subAction && method === "DELETE") {
        if (!isOwner && !isAdmin) {
          return errorJson("Only the document owner or an administrator can delete this document.", 403);
        }

        await deleteDocumentFile(doc.storageFilename);
        await db.delete(documents).where(eq(documents.id, doc.id));

        await logAuditEvent({
          action: "DOCUMENT_DELETED",
          actorId: auth.user.id,
          actorEmail: auth.user.email,
          resourceType: "Document",
          resourceId: doc.id,
          status: "SUCCESS",
          ipAddress: clientIp,
          userAgent,
          details: `Document ${doc.title} permanently deleted.`,
        });

        return json({ message: "Document deleted successfully." });
      }
    }

    // Default 404 for unhandled API paths
    return errorJson(`API endpoint not found: ${method} ${pathname}`, 404);
  } catch (err: any) {
    console.error("API error:", err);
    return errorJson(err.message || "Internal server error", 500);
  }
};

export const config: Config = {
  path: ["/api", "/api/*"],
};

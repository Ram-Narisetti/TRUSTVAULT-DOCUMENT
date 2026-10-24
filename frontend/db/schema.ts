import { pgTable, serial, text, varchar, integer, boolean, timestamp, unique } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 120 }).notNull().unique(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 256 }).notNull(),
  fullName: varchar("full_name", { length: 120 }).notNull(),
  role: varchar("role", { length: 20 }).default("owner").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at"),
  avatarUrl: text("avatar_url"),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  uuid: varchar("uuid", { length: 36 }).notNull().unique(),
  ownerId: integer("owner_id").notNull().references(() => users.id),
  title: varchar("title", { length: 255 }).notNull(),
  originalFilename: varchar("original_filename", { length: 255 }).notNull(),
  storageFilename: varchar("storage_filename", { length: 255 }).notNull().unique(),
  fileSize: integer("file_size").notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  fileExtension: varchar("file_extension", { length: 20 }).notNull(),
  fileHash: varchar("file_hash", { length: 64 }).notNull(),
  category: varchar("category", { length: 50 }).default("Other").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const documentPermissions = pgTable("document_permissions", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  permissionLevel: varchar("permission_level", { length: 10 }).notNull(),
  grantedById: integer("granted_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  unique("uq_doc_user_permission").on(t.documentId, t.userId),
]);

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
  actorEmail: varchar("actor_email", { length: 120 }),
  action: varchar("action", { length: 60 }).notNull(),
  resourceType: varchar("resource_type", { length: 40 }),
  resourceId: varchar("resource_id", { length: 100 }),
  status: varchar("status", { length: 20 }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: varchar("user_agent", { length: 255 }),
  details: text("details"),
});

export const revokedTokens = pgTable("revoked_tokens", {
  id: serial("id").primaryKey(),
  jti: varchar("jti", { length: 36 }).notNull().unique(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  revokedAt: timestamp("revoked_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

import crypto from "node:crypto";
import { count } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { users, documents } from "../../../db/schema.js";
import { hashPassword } from "./auth.js";
import { saveDocumentFile } from "./storage.js";

let seedPromise: Promise<void> | null = null;

export async function ensureDefaultSeeded(): Promise<void> {
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    try {
      const [{ value: userCount }] = await db.select({ value: count() }).from(users);
      if (userCount > 0) return;

      console.log("[*] Seeding default database accounts and initial records...");

      // 1. Admin
      const adminPassHash = hashPassword("AdminVault2026!");
      await db
        .insert(users)
        .values({
          email: "admin@trustvault.local",
          username: "admin_security",
          fullName: "Chief Security Officer",
          role: "admin",
          isActive: true,
          passwordHash: adminPassHash,
        });

      // 2. Owner
      const ownerPassHash = hashPassword("OwnerVault2026!");
      const [owner] = await db
        .insert(users)
        .values({
          email: "owner@trustvault.local",
          username: "john_owner",
          fullName: "John Document Owner",
          role: "owner",
          isActive: true,
          passwordHash: ownerPassHash,
        })
        .returning();

      // 3. Viewer
      const viewerPassHash = hashPassword("ViewerVault2026!");
      await db.insert(users).values({
        email: "viewer@trustvault.local",
        username: "alice_viewer",
        fullName: "Alice Compliance Auditor",
        role: "viewer",
        isActive: true,
        passwordHash: viewerPassHash,
      });

      // 4. Sample Documents for Owner
      const sampleDocs = [
        {
          title: "SOC2_Security_Compliance_Audit_2026.pdf",
          category: "Legal",
          desc: "Annual independent cybersecurity audit assessment and control validation.",
          content: Buffer.from("%PDF-1.4\n% TrustVault SOC2 Security Audit 2026 report verified.\n"),
        },
        {
          title: "Enterprise_Risk_Assessment_Q1.pdf",
          category: "Finance",
          desc: "Quarterly enterprise risk appraisal and mitigation policies.",
          content: Buffer.from("%PDF-1.4\n% TrustVault Q1 Financial Risk Assessment.\n"),
        },
        {
          title: "Incident_Response_Playbook.pdf",
          category: "Work",
          desc: "Standard operating procedures for security incident containment.",
          content: Buffer.from("%PDF-1.4\n% TrustVault Incident Response Playbook v4.\n"),
        },
      ];

      for (const item of sampleDocs) {
        const fileUuid = crypto.randomUUID();
        const storageFilename = `${fileUuid}_${item.title.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const fileHash = crypto.createHash("sha256").update(item.content).digest("hex");

        await saveDocumentFile(storageFilename, item.content);

        await db.insert(documents).values({
          uuid: fileUuid,
          ownerId: owner.id,
          title: item.title,
          originalFilename: item.title,
          storageFilename,
          fileSize: item.content.length,
          mimeType: "application/pdf",
          fileExtension: "pdf",
          fileHash,
          category: item.category,
          description: item.desc,
        });
      }

      console.log("[*] Seeding completed successfully.");
    } catch (err) {
      console.error("Default database seeding encountered an error (continuing):", err);
    }
  })();

  return seedPromise;
}

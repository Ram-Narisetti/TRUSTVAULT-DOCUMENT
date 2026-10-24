import { db } from "../../../db/index.js";
import { auditLogs } from "../../../db/schema.js";

interface LogEventOptions {
  action: string;
  actorId?: number | null;
  actorEmail?: string | null;
  resourceType?: string | null;
  resourceId?: string | number | null;
  status: "SUCCESS" | "DENIED" | "FAILURE";
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: any;
}

export async function logAuditEvent(options: LogEventOptions) {
  try {
    let detailsString: string | null = null;
    if (options.details !== undefined && options.details !== null) {
      detailsString =
        typeof options.details === "string" ? options.details : JSON.stringify(options.details);
    }

    await db.insert(auditLogs).values({
      action: options.action,
      actorId: options.actorId || null,
      actorEmail: options.actorEmail || null,
      resourceType: options.resourceType || null,
      resourceId: options.resourceId ? String(options.resourceId) : null,
      status: options.status,
      ipAddress: options.ipAddress || null,
      userAgent: options.userAgent || null,
      details: detailsString,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("Failed to log audit event:", err);
  }
}

export function toAuditLogDict(log: typeof auditLogs.$inferSelect) {
  let parsedDetails: any = log.details;
  if (log.details) {
    try {
      parsedDetails = JSON.parse(log.details);
    } catch {
      parsedDetails = log.details;
    }
  }

  const d = log.timestamp ? new Date(log.timestamp) : new Date();
  const iso = d.toISOString();

  // Convert to IST (UTC + 5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(d.getTime() + istOffset);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = String(istDate.getUTCDate()).padStart(2, "0");
  const month = months[istDate.getUTCMonth()];
  const year = istDate.getUTCFullYear();
  let hours = istDate.getUTCHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const mins = String(istDate.getUTCMinutes()).padStart(2, "0");
  const secs = String(istDate.getUTCSeconds()).padStart(2, "0");
  const timestamp_ist = `${day} ${month} ${year}, ${String(hours).padStart(2, "0")}:${mins}:${secs} ${ampm} IST`;

  return {
    id: log.id,
    timestamp: iso,
    timestamp_ist,
    actor_id: log.actorId,
    actor_email: log.actorEmail || "Anonymous",
    action: log.action,
    resource_type: log.resourceType,
    resource_id: log.resourceId,
    status: log.status,
    ip_address: log.ipAddress,
    user_agent: log.userAgent,
    details: parsedDetails,
  };
}

import json
from datetime import datetime, timezone, timedelta
from backend.app.extensions import db


class AuditLog(db.Model):
    """Immutable, append-only security audit log recording system and access events."""
    __tablename__ = "audit_logs"

    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    actor_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    actor_email = db.Column(db.String(120), nullable=True)
    action = db.Column(db.String(60), nullable=False, index=True)
    resource_type = db.Column(db.String(40), nullable=True)
    resource_id = db.Column(db.String(100), nullable=True)
    status = db.Column(db.String(20), nullable=False)  # SUCCESS, DENIED, FAILURE
    ip_address = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    details = db.Column(db.Text, nullable=True)

    actor = db.relationship("User", foreign_keys=[actor_id])

    def to_dict(self) -> dict:
        parsed_details = None
        if self.details:
            try:
                parsed_details = json.loads(self.details)
            except Exception:
                parsed_details = self.details

        ts_iso = None
        ts_ist = None
        if self.timestamp:
            ts = self.timestamp if self.timestamp.tzinfo else self.timestamp.replace(tzinfo=timezone.utc)
            ts_iso = ts.isoformat()
            ist_tz = timezone(timedelta(hours=5, minutes=30))
            ts_ist = ts.astimezone(ist_tz).strftime("%d %b %Y, %I:%M:%S %p IST")

        return {
            "id": self.id,
            "timestamp": ts_iso,
            "timestamp_ist": ts_ist,
            "actor_id": self.actor_id,
            "actor_email": self.actor_email or (self.actor.email if self.actor else "Anonymous"),
            "action": self.action,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "status": self.status,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "details": parsed_details,
        }

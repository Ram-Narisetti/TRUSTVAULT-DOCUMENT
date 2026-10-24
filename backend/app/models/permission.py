from datetime import datetime, timezone
from backend.app.extensions import db


class DocumentPermission(db.Model):
    """Document access grant representing VIEW or EDIT permission."""
    __tablename__ = "document_permissions"

    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    permission_level = db.Column(db.String(10), nullable=False)  # VIEW, EDIT
    granted_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        db.UniqueConstraint("document_id", "user_id", name="uq_doc_user_permission"),
    )

    granter = db.relationship("User", foreign_keys=[granted_by_id])

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "document_id": self.document_id,
            "user_id": self.user_id,
            "user_name": self.user.full_name if self.user else None,
            "user_email": self.user.email if self.user else None,
            "user_avatar_url": self.user.avatar_url if self.user else None,
            "permission_level": self.permission_level,
            "granted_by_id": self.granted_by_id,
            "granted_by_name": self.granter.full_name if self.granter else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

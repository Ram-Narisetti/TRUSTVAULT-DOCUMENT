import uuid
from datetime import datetime, timezone
from backend.app.extensions import db


class Document(db.Model):
    """Document metadata model with file integrity tracking."""
    __tablename__ = "documents"

    id = db.Column(db.Integer, primary_key=True)
    uuid = db.Column(db.String(36), unique=True, default=lambda: str(uuid.uuid4()), nullable=False, index=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    title = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    storage_filename = db.Column(db.String(255), unique=True, nullable=False)
    file_size = db.Column(db.Integer, nullable=False)
    mime_type = db.Column(db.String(100), nullable=False)
    file_extension = db.Column(db.String(20), nullable=False)
    file_hash = db.Column(db.String(64), nullable=False)  # SHA-256
    category = db.Column(db.String(50), default="Other", nullable=False, index=True)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    permissions = db.relationship("DocumentPermission", backref="document", lazy="dynamic", cascade="all, delete-orphan")

    def to_dict(self, current_user_id=None) -> dict:
        """Serialize document metadata, omitting private storage filename."""
        data = {
            "id": self.id,
            "uuid": self.uuid,
            "owner_id": self.owner_id,
            "owner_name": self.owner.full_name if self.owner else None,
            "owner_email": self.owner.email if self.owner else None,
            "owner_avatar_url": self.owner.avatar_url if self.owner else None,
            "title": self.title,
            "original_filename": self.original_filename,
            "file_size": self.file_size,
            "mime_type": self.mime_type,
            "file_extension": self.file_extension,
            "file_hash": self.file_hash,
            "category": self.category,
            "description": self.description,
            "created_at": (self.created_at if self.created_at.tzinfo else self.created_at.replace(tzinfo=timezone.utc)).isoformat() if self.created_at else None,
            "updated_at": (self.updated_at if self.updated_at.tzinfo else self.updated_at.replace(tzinfo=timezone.utc)).isoformat() if self.updated_at else None,
            "shared_count": self.permissions.count(),
        }

        if current_user_id:
            if current_user_id == self.owner_id:
                data["user_permission"] = "OWNER"
            else:
                perm = self.permissions.filter_by(user_id=current_user_id).first()
                data["user_permission"] = perm.permission_level if perm else None

        return data

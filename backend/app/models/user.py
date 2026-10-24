from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
from backend.app.extensions import db


class User(db.Model):
    """User account model supporting role-based access."""
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    username = db.Column(db.String(64), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    full_name = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(20), default="owner", nullable=False)  # admin, owner, viewer
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    last_login_at = db.Column(db.DateTime, nullable=True)

    avatar_url = db.Column(db.Text, nullable=True)

    # Relationships
    owned_documents = db.relationship("Document", backref="owner", lazy="dynamic", foreign_keys="Document.owner_id")
    shared_permissions = db.relationship("DocumentPermission", backref="user", lazy="dynamic", foreign_keys="DocumentPermission.user_id", cascade="all, delete-orphan")

    def set_password(self, password: str) -> None:
        """Hash password using scrypt."""
        self.password_hash = generate_password_hash(password, method="scrypt")

    def check_password(self, password: str) -> bool:
        """Verify password against scrypt hash."""
        return check_password_hash(self.password_hash, password)

    def to_dict(self) -> dict:
        """Safe serialization excluding password hash."""
        return {
            "id": self.id,
            "email": self.email,
            "username": self.username,
            "full_name": self.full_name,
            "role": self.role,
            "is_active": self.is_active,
            "avatar_url": self.avatar_url,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_login_at": self.last_login_at.isoformat() if self.last_login_at else None,
        }

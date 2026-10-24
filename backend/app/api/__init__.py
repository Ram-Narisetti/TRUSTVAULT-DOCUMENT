from backend.app.api.auth import auth_bp
from backend.app.api.documents import documents_bp
from backend.app.api.sharing import sharing_bp
from backend.app.api.audit import audit_bp
from backend.app.api.users import users_bp
from backend.app.api.system import system_bp

__all__ = ["auth_bp", "documents_bp", "sharing_bp", "audit_bp", "users_bp", "system_bp"]

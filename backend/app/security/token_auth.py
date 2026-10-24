import uuid
from datetime import datetime, timezone, timedelta
from functools import wraps
import jwt
from flask import request, current_app, jsonify, g
from backend.app.models.user import User
from backend.app.models.revoked_token import RevokedToken
from backend.app.extensions import db


def generate_token(user: User, expires_delta: timedelta = None) -> str:
    """Generate a signed JWT token with a unique jti."""
    now = datetime.now(timezone.utc)
    delta = expires_delta or current_app.config["JWT_EXPIRATION_DELTA"]
    exp = now + delta
    jti = str(uuid.uuid4())

    payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }

    return jwt.encode(payload, current_app.config["JWT_SECRET_KEY"], algorithm="HS256")


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token."""
    return jwt.decode(token, current_app.config["JWT_SECRET_KEY"], algorithms=["HS256"])


def is_token_revoked(jti: str) -> bool:
    """Check if token jti exists in the revoked tokens list."""
    return RevokedToken.query.filter_by(jti=jti).first() is not None


def revoke_token(jti: str, user_id: int, expires_at: datetime) -> None:
    """Add token jti to revoked tokens table."""
    revoked = RevokedToken(jti=jti, user_id=user_id, expires_at=expires_at)
    db.session.add(revoked)
    db.session.commit()


def get_token_from_header() -> str | None:
    """Extract Bearer token from Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.split(" ", 1)[1].strip()
    return None


def require_auth(f):
    """Decorator to enforce valid authentication token and active user status."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = get_token_from_header()
        if not token:
            return jsonify({"error": "Authentication token is required."}), 401

        try:
            payload = decode_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Session token has expired. Please log in again."}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid authentication token."}), 401

        jti = payload.get("jti")
        if not jti or is_token_revoked(jti):
            return jsonify({"error": "Session token has been revoked."}), 401

        sub_val = payload.get("sub")
        try:
            user_id = int(sub_val) if sub_val is not None else None
        except (ValueError, TypeError):
            user_id = None

        user = db.session.get(User, user_id) if user_id is not None else None
        if not user:
            return jsonify({"error": "User account no longer exists."}), 401

        if not user.is_active:
            return jsonify({"error": "Your account has been deactivated. Please contact an administrator."}), 403

        g.current_user = user
        g.token_payload = payload
        g.token_jti = jti
        return f(*args, **kwargs)

    return decorated_function


def require_role(*roles):
    """Decorator to enforce minimum role authorization."""
    def decorator(f):
        @wraps(f)
        @require_auth
        def decorated_function(*args, **kwargs):
            if g.current_user.role not in roles:
                from backend.app.services.audit_service import AuditService
                AuditService.log_event(
                    action="ACCESS_DENIED",
                    actor=g.current_user,
                    resource_type="Role",
                    resource_id=f"Required:{','.join(roles)}",
                    status="DENIED",
                    details=f"User {g.current_user.email} attempted role-restricted endpoint."
                )
                return jsonify({"error": "You do not have permission to perform this action."}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

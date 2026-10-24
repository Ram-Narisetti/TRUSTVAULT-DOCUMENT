from datetime import datetime, timezone
from werkzeug.security import check_password_hash, generate_password_hash
from backend.app.models.user import User
from backend.app.extensions import db
from backend.app.security.token_auth import generate_token, revoke_token
from backend.app.services.audit_service import AuditService
from backend.app.validators.auth_validator import (
    validate_registration_payload,
    validate_password_strength,
)

# Dummy hash for constant-time comparison against nonexistent users
DUMMY_HASH = generate_password_hash("DummyPassword123!", method="scrypt")


class AuthService:
    """Authentication operations with timing attack and user enumeration defenses."""

    @classmethod
    def register(cls, data: dict) -> tuple[dict | None, str | None]:
        is_valid, err_msg = validate_registration_payload(data)
        if not is_valid:
            return None, err_msg

        email = data["email"].strip().lower()
        username = data["username"].strip().lower()

        if User.query.filter((User.email == email) | (User.username == username)).first():
            # Mitigate user enumeration by not revealing which specific field collided
            return None, "An account with these credentials already exists."

        # Security rule: Public registration NEVER assigns admin role
        user = User(
            email=email,
            username=username,
            full_name=data["full_name"].strip(),
            role="owner",  # Default owner-capable role
            is_active=True,
        )
        user.set_password(data["password"])

        db.session.add(user)
        db.session.commit()

        AuditService.log_event(
            action="AUTH_REGISTER",
            actor=user,
            resource_type="User",
            resource_id=user.id,
            status="SUCCESS",
            details={"email": user.email, "role": user.role},
        )

        token = generate_token(user)
        return {"user": user.to_dict(), "token": token}, None

    @classmethod
    def login(cls, data: dict) -> tuple[dict | None, str | None]:
        if not data or not isinstance(data, dict):
            return None, "Invalid request."

        email = data.get("email", "").strip().lower()
        password = data.get("password", "")

        user = User.query.filter_by(email=email).first()

        if not user:
            # Perform dummy check to equalize response time
            check_password_hash(DUMMY_HASH, password)
            AuditService.log_event(
                action="AUTH_LOGIN_FAILED",
                actor=None,
                resource_type="Auth",
                resource_id=email,
                status="FAILURE",
                details="Attempted login with non-existent email.",
            )
            return None, "Invalid email or password."

        if not user.is_active:
            AuditService.log_event(
                action="AUTH_LOGIN_FAILED",
                actor=user,
                resource_type="Auth",
                resource_id=user.id,
                status="DENIED",
                details="Deactivated user attempted login.",
            )
            return None, "Your account has been deactivated. Please contact an administrator."

        if not user.check_password(password):
            AuditService.log_event(
                action="AUTH_LOGIN_FAILED",
                actor=user,
                resource_type="Auth",
                resource_id=user.id,
                status="FAILURE",
                details="Incorrect password provided.",
            )
            return None, "Invalid email or password."

        # Update last login
        user.last_login_at = datetime.now(timezone.utc)
        db.session.commit()

        AuditService.log_event(
            action="AUTH_LOGIN_SUCCESS",
            actor=user,
            resource_type="Auth",
            resource_id=user.id,
            status="SUCCESS",
        )

        token = generate_token(user)
        return {"user": user.to_dict(), "token": token}, None

    @classmethod
    def logout(cls, jti: str, user: User, exp_timestamp: int) -> None:
        expires_at = datetime.fromtimestamp(exp_timestamp, tz=timezone.utc)
        revoke_token(jti, user.id, expires_at)
        AuditService.log_event(
            action="AUTH_LOGOUT",
            actor=user,
            resource_type="Auth",
            resource_id=user.id,
            status="SUCCESS",
        )

    @classmethod
    def change_password(cls, user: User, current_password: str, new_password: str) -> tuple[bool, str]:
        if not user.check_password(current_password):
            AuditService.log_event(
                action="PASSWORD_CHANGE",
                actor=user,
                resource_type="User",
                resource_id=user.id,
                status="FAILURE",
                details="Incorrect current password provided.",
            )
            return False, "Current password does not match."

        is_valid, err_msg = validate_password_strength(new_password)
        if not is_valid:
            return False, err_msg

        user.set_password(new_password)
        db.session.commit()

        AuditService.log_event(
            action="PASSWORD_CHANGE",
            actor=user,
            resource_type="User",
            resource_id=user.id,
            status="SUCCESS",
        )
        return True, "Password updated successfully."

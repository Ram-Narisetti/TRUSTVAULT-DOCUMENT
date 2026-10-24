from backend.app.models.user import User
from backend.app.extensions import db
from backend.app.services.audit_service import AuditService


class UserService:
    """Administrative user management and user directory lookups."""

    @classmethod
    def get_users(
        cls, search: str = None, role: str = None, is_active: bool = None, page: int = 1, per_page: int = 20
    ) -> dict:
        query = User.query.order_by(User.created_at.desc())

        if search:
            query = query.filter(
                (User.email.ilike(f"%{search}%"))
                | (User.username.ilike(f"%{search}%"))
                | (User.full_name.ilike(f"%{search}%"))
            )
        if role:
            query = query.filter_by(role=role)
        if is_active is not None:
            query = query.filter_by(is_active=is_active)

        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        return {
            "users": [user.to_dict() for user in pagination.items],
            "total": pagination.total,
            "page": pagination.page,
            "pages": pagination.pages,
        }

    @classmethod
    def toggle_user_active_status(cls, admin: User, target_user_id: int) -> tuple[User | None, str | None]:
        target = db.session.get(User, target_user_id)
        if not target:
            return None, "User not found."

        if target.id == admin.id:
            return None, "Administrators cannot deactivate their own account."

        target.is_active = not target.is_active
        db.session.commit()

        status_str = "ACTIVATED" if target.is_active else "DEACTIVATED"
        AuditService.log_event(
            action="USER_STATUS_CHANGE",
            actor=admin,
            resource_type="User",
            resource_id=target.id,
            status="SUCCESS",
            details={"email": target.email, "new_active_status": target.is_active, "action": status_str},
        )
        return target, None

    @classmethod
    def search_recipients(cls, query_str: str, current_user_id: int, limit: int = 10) -> list[dict]:
        """Search registered, active users for sharing autocomplete."""
        if not query_str or len(query_str.strip()) < 2:
            return []

        clean_query = f"%{query_str.strip()}%"
        users = (
            User.query.filter(
                User.id != current_user_id,
                User.is_active == True,
                (User.email.ilike(clean_query) | User.full_name.ilike(clean_query) | User.username.ilike(clean_query)),
            )
            .limit(limit)
            .all()
        )

        return [
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "username": u.username,
                "avatar_url": u.avatar_url,
            }
            for u in users
        ]

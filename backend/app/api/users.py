from flask import Blueprint, request, jsonify, g
from backend.app.services.user_service import UserService
from backend.app.security.token_auth import require_role

users_bp = Blueprint("users", __name__, url_prefix="/api/users")


@users_bp.route("", methods=["GET"])
@require_role("admin")
def list_users():
    """List registered users (Admin only)."""
    search = request.args.get("search")
    role = request.args.get("role")
    is_active_param = request.args.get("is_active")
    is_active = None
    if is_active_param is not None:
        is_active = is_active_param.lower() in ("true", "1")

    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    data = UserService.get_users(
        search=search, role=role, is_active=is_active, page=page, per_page=per_page
    )
    return jsonify(data), 200


@users_bp.route("/<int:user_id>/status", methods=["PUT"])
@require_role("admin")
def toggle_status(user_id: int):
    """Toggle user active / deactivated state (Admin only)."""
    updated_user, err = UserService.toggle_user_active_status(g.current_user, user_id)
    if err:
        return jsonify({"error": err}), 400

    return jsonify({
        "message": f"User status successfully updated to {'active' if updated_user.is_active else 'deactivated'}.",
        "user": updated_user.to_dict(),
    }), 200

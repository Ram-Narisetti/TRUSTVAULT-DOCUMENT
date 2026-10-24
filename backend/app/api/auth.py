import base64
from flask import Blueprint, request, jsonify, g
from backend.app.services.auth_service import AuthService
from backend.app.services.audit_service import AuditService
from backend.app.security.token_auth import require_auth
from backend.app.extensions import limiter, db

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.route("/register", methods=["POST"])
@limiter.limit("10/minute")
def register():
    data = request.get_json() or {}
    res, err = AuthService.register(data)
    if err:
        return jsonify({"error": err}), 400
    return jsonify(res), 201


@auth_bp.route("/login", methods=["POST"])
@limiter.limit("15/minute")
def login():
    data = request.get_json() or {}
    res, err = AuthService.login(data)
    if err:
        # Inactive or invalid
        status_code = 403 if "deactivated" in err.lower() else 401
        return jsonify({"error": err}), status_code
    return jsonify(res), 200


@auth_bp.route("/logout", methods=["POST"])
@require_auth
def logout():
    AuthService.logout(g.token_jti, g.current_user, g.token_payload.get("exp", 0))
    return jsonify({"message": "Successfully logged out."}), 200


@auth_bp.route("/me", methods=["GET"])
@require_auth
def get_me():
    return jsonify({"user": g.current_user.to_dict()}), 200


@auth_bp.route("/profile", methods=["PUT"])
@require_auth
def update_profile():
    data = request.get_json() or {}
    full_name = data.get("full_name")
    avatar_url = data.get("avatar_url")

    user = g.current_user
    if full_name is not None:
        full_name = full_name.strip()
        if not full_name:
            return jsonify({"error": "Full name cannot be empty."}), 400
        user.full_name = full_name

    if avatar_url is not None:
        if avatar_url and not (avatar_url.startswith("data:image/") or avatar_url.startswith("http://") or avatar_url.startswith("https://")):
            return jsonify({"error": "Invalid avatar format. Must be an image data URL or web URL."}), 400
        user.avatar_url = avatar_url

    db.session.commit()
    AuditService.log_event(
        action="PROFILE_UPDATED",
        actor=user,
        resource_type="User",
        resource_id=user.id,
        status="SUCCESS",
        details="User updated profile information.",
    )
    return jsonify({"message": "Profile updated successfully.", "user": user.to_dict()}), 200


@auth_bp.route("/avatar", methods=["POST"])
@require_auth
def upload_avatar():
    user = g.current_user
    avatar_data_url = None

    if "avatar" in request.files:
        file = request.files["avatar"]
        if not file.filename:
            return jsonify({"error": "No file selected."}), 400

        ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
        if ext not in ["jpg", "jpeg", "png", "webp", "gif", "svg"]:
            return jsonify({"error": "Only JPG, PNG, WEBP, GIF, or SVG images are supported."}), 400

        file_bytes = file.read()
        if len(file_bytes) > 2 * 1024 * 1024:
            return jsonify({"error": "Avatar image must be smaller than 2 MB."}), 400

        mime = f"image/{'jpeg' if ext in ['jpg', 'jpeg'] else 'svg+xml' if ext == 'svg' else ext}"
        b64 = base64.b64encode(file_bytes).decode("utf-8")
        avatar_data_url = f"data:{mime};base64,{b64}"
    else:
        data = request.get_json() or {}
        avatar_data_url = data.get("avatar")

    if not avatar_data_url:
        return jsonify({"error": "No avatar image provided."}), 400

    user.avatar_url = avatar_data_url
    db.session.commit()

    AuditService.log_event(
        action="AVATAR_UPDATED",
        actor=user,
        resource_type="User",
        resource_id=user.id,
        status="SUCCESS",
        details="User updated profile avatar.",
    )
    return jsonify({"message": "Profile photo updated successfully.", "user": user.to_dict()}), 200


@auth_bp.route("/avatar", methods=["DELETE"])
@require_auth
def remove_avatar():
    user = g.current_user
    user.avatar_url = None
    db.session.commit()

    AuditService.log_event(
        action="AVATAR_REMOVED",
        actor=user,
        resource_type="User",
        resource_id=user.id,
        status="SUCCESS",
        details="User removed profile photo.",
    )
    return jsonify({"message": "Profile photo removed.", "user": user.to_dict()}), 200


@auth_bp.route("/password", methods=["PUT"])
@require_auth
def change_password():
    data = request.get_json() or {}
    current_pass = data.get("current_password", "")
    new_pass = data.get("new_password", "")

    success, msg = AuthService.change_password(g.current_user, current_pass, new_pass)
    if not success:
        return jsonify({"error": msg}), 400
    return jsonify({"message": msg}), 200

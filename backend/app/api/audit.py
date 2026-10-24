from flask import Blueprint, request, jsonify, g
from backend.app.services.audit_service import AuditService
from backend.app.security.token_auth import require_auth, require_role

audit_bp = Blueprint("audit", __name__, url_prefix="/api/audit")


@audit_bp.route("/system", methods=["GET"])
@require_role("admin")
def get_system_audit_logs():
    """System-wide audit trail accessible only to administrators."""
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    action = request.args.get("action")
    status = request.args.get("status")
    search = request.args.get("search")

    data = AuditService.get_system_logs(
        page=page, per_page=per_page, action=action, status=status, search=search
    )
    return jsonify(data), 200


@audit_bp.route("/my-documents", methods=["GET"])
@require_auth
def get_owner_document_logs():
    """Audit logs strictly scoped to documents owned by the requesting user."""
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    data = AuditService.get_user_document_logs(user_id=g.current_user.id, page=page, per_page=per_page)
    return jsonify(data), 200

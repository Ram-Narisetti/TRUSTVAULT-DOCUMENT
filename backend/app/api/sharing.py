from flask import Blueprint, request, jsonify, g
from backend.app.services.permission_service import PermissionService
from backend.app.services.user_service import UserService
from backend.app.security.token_auth import require_auth
from backend.app.models.document import Document
from backend.app.extensions import db

sharing_bp = Blueprint("sharing", __name__, url_prefix="/api")


@sharing_bp.route("/documents/<int:doc_id>/permissions", methods=["GET"])
@require_auth
def get_permissions(doc_id: int):
    doc = db.session.get(Document, doc_id)
    if not doc:
        return jsonify({"error": "Document not found."}), 404

    grants, err = PermissionService.get_document_permissions(g.current_user, doc)
    if err:
        return jsonify({"error": err}), 403

    return jsonify({"permissions": grants}), 200


@sharing_bp.route("/documents/<int:doc_id>/permissions", methods=["POST"])
@require_auth
def grant_permission(doc_id: int):
    doc = db.session.get(Document, doc_id)
    if not doc:
        return jsonify({"error": "Document not found."}), 404

    payload = request.get_json() or {}
    grant, err = PermissionService.grant_permission(g.current_user, doc, payload)
    if err:
        status_code = 403 if "permission" in err.lower() or "authority" in err.lower() or "owner" in err.lower() else 400
        return jsonify({"error": err}), status_code

    return jsonify({"permission": grant.to_dict(), "message": "Access permission granted successfully."}), 201


@sharing_bp.route("/documents/<int:doc_id>/permissions/<int:target_user_id>", methods=["DELETE"])
@require_auth
def revoke_permission(doc_id: int, target_user_id: int):
    doc = db.session.get(Document, doc_id)
    if not doc:
        return jsonify({"error": "Document not found."}), 404

    success, err = PermissionService.revoke_permission(g.current_user, doc, target_user_id)
    if not success:
        status_code = 403 if "owner" in (err or "").lower() or "denied" in (err or "").lower() else 400
        return jsonify({"error": err}), status_code

    return jsonify({"message": "Permission revoked successfully. Access has been immediately terminated."}), 200


@sharing_bp.route("/sharing/recipients", methods=["GET"])
@require_auth
def search_recipients():
    q = request.args.get("q", "")
    users = UserService.search_recipients(q, g.current_user.id)
    return jsonify({"users": users}), 200

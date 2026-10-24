from flask import Blueprint, jsonify, g
from backend.app.models.user import User
from backend.app.models.document import Document
from backend.app.models.permission import DocumentPermission
from backend.app.models.audit_log import AuditLog
from backend.app.security.token_auth import require_auth, require_role
from backend.app.validators.document_validator import ALLOWED_CATEGORIES
from backend.app.extensions import db

system_bp = Blueprint("system", __name__, url_prefix="/api/system")


@system_bp.route("/categories", methods=["GET"])
def get_categories():
    """Return permitted document classification categories."""
    return jsonify({"categories": sorted(list(ALLOWED_CATEGORIES))}), 200


@system_bp.route("/stats", methods=["GET"])
@require_role("admin")
def get_admin_stats():
    """Live system dashboard metrics computed directly from database."""
    total_users = User.query.count()
    active_users = User.query.filter_by(is_active=True).count()
    deactivated_users = total_users - active_users

    total_documents = Document.query.count()
    total_shares = DocumentPermission.query.count()

    total_audits = AuditLog.query.count()
    denied_attempts = AuditLog.query.filter_by(status="DENIED").count()

    # Total storage used in bytes
    storage_bytes = db.session.query(db.func.sum(Document.file_size)).scalar() or 0

    # Role breakdown
    role_counts = {
        "admin": User.query.filter_by(role="admin").count(),
        "owner": User.query.filter_by(role="owner").count(),
        "viewer": User.query.filter_by(role="viewer").count(),
    }

    # Recent 6 audit events
    recent_events = (
        AuditLog.query.order_by(AuditLog.timestamp.desc())
        .limit(6)
        .all()
    )

    return jsonify({
        "total_users": total_users,
        "active_users": active_users,
        "deactivated_users": deactivated_users,
        "total_documents": total_documents,
        "total_shares": total_shares,
        "total_audits": total_audits,
        "denied_attempts": denied_attempts,
        "storage_bytes": storage_bytes,
        "role_breakdown": role_counts,
        "recent_activity": [e.to_dict() for e in recent_events],
    }), 200


@system_bp.route("/owner-stats", methods=["GET"])
@require_auth
def get_owner_stats():
    """Metrics for the authenticated owner's dashboard."""
    user_id = g.current_user.id
    my_docs_count = Document.query.filter_by(owner_id=user_id).count()

    # Total storage consumed by user
    user_storage = (
        db.session.query(db.func.sum(Document.file_size))
        .filter(Document.owner_id == user_id)
        .scalar()
        or 0
    )

    # Documents shared with others by this user
    shared_out_count = (
        DocumentPermission.query.join(Document, Document.id == DocumentPermission.document_id)
        .filter(Document.owner_id == user_id)
        .count()
    )

    # Documents shared with this user
    shared_with_me_count = DocumentPermission.query.filter_by(user_id=user_id).count()

    # Recent 5 uploads
    recent_docs = (
        Document.query.filter_by(owner_id=user_id)
        .order_by(Document.created_at.desc())
        .limit(5)
        .all()
    )

    return jsonify({
        "my_documents_count": my_docs_count,
        "storage_bytes": user_storage,
        "shared_out_count": shared_out_count,
        "shared_with_me_count": shared_with_me_count,
        "recent_uploads": [d.to_dict(current_user_id=user_id) for d in recent_docs],
    }), 200

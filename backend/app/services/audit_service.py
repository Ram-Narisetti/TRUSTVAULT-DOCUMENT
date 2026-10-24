import json
from flask import request, has_request_context
from backend.app.models.audit_log import AuditLog
from backend.app.models.document import Document
from backend.app.extensions import db


class AuditService:
    """Service to create and query append-only audit logs."""

    SENSITIVE_KEYS = {"password", "token", "secret", "file_content", "authorization"}

    @classmethod
    def _sanitize_details(cls, details):
        if not details:
            return None
        if isinstance(details, dict):
            clean = {}
            for k, v in details.items():
                if any(s in k.lower() for s in cls.SENSITIVE_KEYS):
                    clean[k] = "[REDACTED]"
                else:
                    clean[k] = v
            return json.dumps(clean)
        return str(details)

    @classmethod
    def log_event(
        cls,
        action: str,
        actor=None,
        resource_type: str = None,
        resource_id: str = None,
        status: str = "SUCCESS",
        details=None,
    ) -> AuditLog:
        """Record an immutable security event."""
        ip_address = None
        user_agent = None

        if has_request_context():
            ip_address = request.headers.get("X-Forwarded-For", request.remote_addr)
            if ip_address and "," in ip_address:
                ip_address = ip_address.split(",")[0].strip()
            user_agent = request.headers.get("User-Agent", "")[:250]

        actor_id = getattr(actor, "id", None) if actor else None
        actor_email = getattr(actor, "email", None) if actor else None

        log_entry = AuditLog(
            actor_id=actor_id,
            actor_email=actor_email,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id is not None else None,
            status=status,
            ip_address=ip_address,
            user_agent=user_agent,
            details=cls._sanitize_details(details),
        )

        try:
            db.session.add(log_entry)
            db.session.commit()
        except Exception:
            db.session.rollback()

        return log_entry

    @classmethod
    def get_system_logs(
        cls, page: int = 1, per_page: int = 20, action: str = None, status: str = None, search: str = None
    ):
        """Query system-wide audit logs with filters (Admin only)."""
        query = AuditLog.query.order_by(AuditLog.timestamp.desc())

        if action:
            query = query.filter(AuditLog.action == action)
        if status:
            query = query.filter(AuditLog.status == status)
        if search:
            query = query.filter(
                (AuditLog.actor_email.ilike(f"%{search}%"))
                | (AuditLog.resource_id.ilike(f"%{search}%"))
                | (AuditLog.action.ilike(f"%{search}%"))
            )

        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        return {
            "logs": [item.to_dict() for item in pagination.items],
            "total": pagination.total,
            "page": pagination.page,
            "pages": pagination.pages,
        }

    @classmethod
    def get_user_document_logs(cls, user_id: int, page: int = 1, per_page: int = 20):
        """Query scoped activity logs only for documents owned by this user."""
        owned_doc_ids = [
            str(doc.id) for doc in Document.query.filter_by(owner_id=user_id).all()
        ]

        if not owned_doc_ids:
            return {"logs": [], "total": 0, "page": page, "pages": 0}

        query = AuditLog.query.filter(
            AuditLog.resource_type == "Document",
            AuditLog.resource_id.in_(owned_doc_ids)
        ).order_by(AuditLog.timestamp.desc())

        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        return {
            "logs": [item.to_dict() for item in pagination.items],
            "total": pagination.total,
            "page": pagination.page,
            "pages": pagination.pages,
        }

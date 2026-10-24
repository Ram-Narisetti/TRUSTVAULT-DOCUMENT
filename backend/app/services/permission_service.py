from backend.app.models.user import User
from backend.app.models.document import Document
from backend.app.models.permission import DocumentPermission
from backend.app.extensions import db
from backend.app.security.authorization import AuthorizationService, Action
from backend.app.services.audit_service import AuditService
from backend.app.validators.document_validator import validate_share_payload


class PermissionService:
    """Document access sharing and immediate revocation management."""

    @classmethod
    def get_document_permissions(cls, user: User, document: Document) -> tuple[list[dict] | None, str | None]:
        # Only owner (or admin reviewing security) can see who has grants
        if document.owner_id != user.id and user.role != "admin":
            AuditService.log_event(
                action="ACCESS_DENIED",
                actor=user,
                resource_type="Permission",
                resource_id=document.id,
                status="DENIED",
                details="Non-owner attempted to view permission grant list.",
            )
            return None, "Only the document owner can inspect permission grants."

        grants = DocumentPermission.query.filter_by(document_id=document.id).all()
        return [grant.to_dict() for grant in grants], None

    @classmethod
    def grant_permission(
        cls, user: User, document: Document, payload: dict
    ) -> tuple[DocumentPermission | None, str | None]:
        # Authorization check: only owner can share
        allowed, msg = AuthorizationService.check_document_access(user, document, Action.SHARE)
        if not allowed:
            AuditService.log_event(
                action="ACCESS_DENIED",
                actor=user,
                resource_type="Document",
                resource_id=document.id,
                status="DENIED",
                details=f"Unauthorized share attempt: {msg}",
            )
            return None, msg

        is_valid, err = validate_share_payload(payload)
        if not is_valid:
            return None, err

        recipient_email = payload["recipient_email"].strip().lower()
        permission_level = payload["permission"].strip().upper()

        recipient = User.query.filter_by(email=recipient_email).first()
        if not recipient:
            return None, "Recipient user account was not found."

        if recipient.id == document.owner_id:
            return None, "Document owner already has full authority over this document."

        # Check existing grant
        existing_grant = DocumentPermission.query.filter_by(
            document_id=document.id, user_id=recipient.id
        ).first()

        if existing_grant:
            existing_grant.permission_level = permission_level
            existing_grant.granted_by_id = user.id
            db.session.commit()
            grant = existing_grant
        else:
            grant = DocumentPermission(
                document_id=document.id,
                user_id=recipient.id,
                permission_level=permission_level,
                granted_by_id=user.id,
            )
            db.session.add(grant)
            db.session.commit()

        AuditService.log_event(
            action="PERMISSION_GRANTED",
            actor=user,
            resource_type="Permission",
            resource_id=grant.id,
            status="SUCCESS",
            details={
                "document_id": document.id,
                "document_title": document.title,
                "recipient_id": recipient.id,
                "recipient_email": recipient.email,
                "permission_level": permission_level,
            },
        )
        return grant, None

    @classmethod
    def revoke_permission(
        cls, user: User, document: Document, target_user_id: int
    ) -> tuple[bool, str | None]:
        # Authorization check: only owner can revoke
        allowed, msg = AuthorizationService.check_document_access(user, document, Action.REVOKE)
        if not allowed:
            AuditService.log_event(
                action="ACCESS_DENIED",
                actor=user,
                resource_type="Document",
                resource_id=document.id,
                status="DENIED",
                details=f"Unauthorized revocation attempt: {msg}",
            )
            return False, msg

        grant = DocumentPermission.query.filter_by(
            document_id=document.id, user_id=target_user_id
        ).first()

        if not grant:
            return False, "No active permission grant found for this user."

        target_email = grant.user.email if grant.user else str(target_user_id)
        db.session.delete(grant)
        db.session.commit()

        AuditService.log_event(
            action="PERMISSION_REVOKED",
            actor=user,
            resource_type="Permission",
            resource_id=document.id,
            status="SUCCESS",
            details={
                "document_id": document.id,
                "document_title": document.title,
                "revoked_user_id": target_user_id,
                "revoked_user_email": target_email,
            },
        )
        return True, None

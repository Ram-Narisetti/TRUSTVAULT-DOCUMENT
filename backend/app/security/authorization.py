from typing import Tuple
from backend.app.models.user import User
from backend.app.models.document import Document
from backend.app.models.permission import DocumentPermission


class Action:
    VIEW = "VIEW"
    DOWNLOAD = "DOWNLOAD"
    EDIT_METADATA = "EDIT_METADATA"
    DELETE = "DELETE"
    SHARE = "SHARE"
    REVOKE = "REVOKE"


class AuthorizationService:
    """
    Centralized, fail-closed authorization engine for document operations.
    Every document access request MUST pass through this service.
    """

    @staticmethod
    def check_document_access(user: User, document: Document, action: str) -> Tuple[bool, str]:
        """
        Evaluate if user has authority to perform action on document.
        Returns (is_authorized, reason_message).
        """
        if not user or not user.is_active:
            return False, "User account is inactive or invalid."

        # Document Owner has full authority for all operations
        if document.owner_id == user.id:
            return True, "Authorized as document owner."

        # For non-owners, check explicit document permissions
        perm = DocumentPermission.query.filter_by(
            document_id=document.id, user_id=user.id
        ).first()

        if perm:
            if action in (Action.VIEW, Action.DOWNLOAD):
                return True, f"Authorized via {perm.permission_level} grant."

            if action == Action.EDIT_METADATA:
                if perm.permission_level == "EDIT":
                    return True, "Authorized to edit metadata via EDIT grant."
                return False, "VIEW permission does not allow editing document metadata."

            if action in (Action.DELETE, Action.SHARE, Action.REVOKE):
                return False, "Only the document owner can manage permissions or delete the document."

        # Admin system override: admins can view metadata for compliance/auditing,
        # but cannot delete or share owners' documents through standard user routes.
        if user.role == "admin":
            if action == Action.VIEW:
                return True, "Authorized as administrator for system metadata inspection."
            return False, "Administrative policy restricts non-owner document mutations."

        return False, "Access denied: you do not have permission for this document."

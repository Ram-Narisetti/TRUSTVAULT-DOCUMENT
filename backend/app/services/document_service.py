from werkzeug.datastructures import FileStorage
from sqlalchemy import or_
from backend.app.models.user import User
from backend.app.models.document import Document
from backend.app.models.permission import DocumentPermission
from backend.app.extensions import db
from backend.app.services.storage_service import StorageService
from backend.app.services.audit_service import AuditService
from backend.app.security.authorization import AuthorizationService, Action
from backend.app.validators.document_validator import validate_document_metadata


class DocumentService:
    """Core document management with authorization enforcement and file lifecycle."""

    @classmethod
    def upload_document(
        cls, user: User, file: FileStorage, title: str, category: str, description: str = ""
    ) -> tuple[Document | None, str | None]:
        if user.role == "viewer":
            AuditService.log_event(
                action="ACCESS_DENIED",
                actor=user,
                resource_type="Document",
                status="DENIED",
                details="Viewer attempted document upload.",
            )
            return None, "Viewer role is not authorized to upload documents."

        # File validation (type, extension, signature)
        is_valid_file, err = StorageService.validate_file(file)
        if not is_valid_file:
            return None, err

        # Metadata validation
        is_valid_meta, err = validate_document_metadata({
            "title": title or file.filename,
            "category": category,
            "description": description,
        })
        if not is_valid_meta:
            return None, err

        try:
            saved_meta = StorageService.save_file(file)
        except Exception as e:
            return None, str(e)

        doc = Document(
            owner_id=user.id,
            title=title.strip() if title else saved_meta["original_filename"],
            original_filename=saved_meta["original_filename"],
            storage_filename=saved_meta["storage_filename"],
            file_size=saved_meta["file_size"],
            mime_type=saved_meta["mime_type"],
            file_extension=saved_meta["file_extension"],
            file_hash=saved_meta["file_hash"],
            category=category.strip(),
            description=description.strip() if description else None,
        )

        try:
            db.session.add(doc)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            # Clean up uploaded storage file on db failure
            StorageService.delete_file(saved_meta["storage_filename"])
            return None, f"Database error during document save: {str(e)}"

        AuditService.log_event(
            action="DOCUMENT_UPLOAD",
            actor=user,
            resource_type="Document",
            resource_id=doc.id,
            status="SUCCESS",
            details={
                "title": doc.title,
                "file_hash": doc.file_hash,
                "size_bytes": doc.file_size,
            },
        )

        return doc, None

    @classmethod
    def get_owned_documents(
        cls,
        user: User,
        search: str = None,
        category: str = None,
        file_type: str = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        page: int = 1,
        per_page: int = 20,
    ) -> dict:
        query = Document.query.filter_by(owner_id=user.id)

        if search:
            query = query.filter(
                (Document.title.ilike(f"%{search}%"))
                | (Document.original_filename.ilike(f"%{search}%"))
                | (Document.description.ilike(f"%{search}%"))
            )
        if category:
            query = query.filter_by(category=category)
        if file_type:
            query = query.filter_by(file_extension=file_type.lower())

        # Sort order
        sort_col = getattr(Document, sort_by, Document.created_at)
        if sort_order.lower() == "asc":
            query = query.order_by(sort_col.asc())
        else:
            query = query.order_by(sort_col.desc())

        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        return {
            "documents": [doc.to_dict(current_user_id=user.id) for doc in pagination.items],
            "total": pagination.total,
            "page": pagination.page,
            "pages": pagination.pages,
        }

    @classmethod
    def get_shared_with_user(
        cls,
        user: User,
        search: str = None,
        category: str = None,
        file_type: str = None,
        page: int = 1,
        per_page: int = 20,
    ) -> dict:
        # Join Document and DocumentPermission
        query = (
            Document.query.join(DocumentPermission, Document.id == DocumentPermission.document_id)
            .filter(DocumentPermission.user_id == user.id)
        )

        if search:
            query = query.filter(
                (Document.title.ilike(f"%{search}%"))
                | (Document.original_filename.ilike(f"%{search}%"))
            )
        if category:
            query = query.filter(Document.category == category)
        if file_type:
            query = query.filter(Document.file_extension == file_type.lower())

        query = query.order_by(DocumentPermission.created_at.desc())
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        return {
            "documents": [doc.to_dict(current_user_id=user.id) for doc in pagination.items],
            "total": pagination.total,
            "page": pagination.page,
            "pages": pagination.pages,
        }

    @classmethod
    def search_accessible_documents(cls, user: User, term: str) -> list[dict]:
        """Server-side search restricted strictly to documents the user owns or has grants to."""
        if not term:
            return []

        search_pat = f"%{term}%"
        # 1. Documents owned by user
        owned = Document.query.filter(
            Document.owner_id == user.id,
            (Document.title.ilike(search_pat) | Document.original_filename.ilike(search_pat))
        ).all()

        # 2. Documents shared with user
        shared = (
            Document.query.join(DocumentPermission, Document.id == DocumentPermission.document_id)
            .filter(
                DocumentPermission.user_id == user.id,
                (Document.title.ilike(search_pat) | Document.original_filename.ilike(search_pat))
            )
            .all()
        )

        # Merge unique docs
        all_docs = {doc.id: doc for doc in (owned + shared)}
        return [doc.to_dict(current_user_id=user.id) for doc in all_docs.values()]

    @classmethod
    def update_metadata(cls, user: User, doc: Document, data: dict) -> tuple[Document | None, str | None]:
        allowed, msg = AuthorizationService.check_document_access(user, doc, Action.EDIT_METADATA)
        if not allowed:
            AuditService.log_event(
                action="ACCESS_DENIED",
                actor=user,
                resource_type="Document",
                resource_id=doc.id,
                status="DENIED",
                details=f"Unauthorized metadata update: {msg}",
            )
            return None, msg

        is_valid, err = validate_document_metadata(data)
        if not is_valid:
            return None, err

        doc.title = data.get("title", doc.title).strip()
        doc.category = data.get("category", doc.category).strip()
        doc.description = data.get("description", doc.description).strip() if data.get("description") else None

        db.session.commit()

        AuditService.log_event(
            action="DOCUMENT_METADATA_UPDATE",
            actor=user,
            resource_type="Document",
            resource_id=doc.id,
            status="SUCCESS",
            details={"title": doc.title, "category": doc.category},
        )
        return doc, None

    @classmethod
    def delete_document(cls, user: User, doc: Document) -> tuple[bool, str | None]:
        allowed, msg = AuthorizationService.check_document_access(user, doc, Action.DELETE)
        if not allowed:
            AuditService.log_event(
                action="ACCESS_DENIED",
                actor=user,
                resource_type="Document",
                resource_id=doc.id,
                status="DENIED",
                details=f"Unauthorized delete attempt: {msg}",
            )
            return False, msg

        storage_file = doc.storage_filename
        doc_id = doc.id
        doc_title = doc.title

        # Safe atomic cleanup: remove database record and physical file
        try:
            db.session.delete(doc)
            db.session.commit()
            StorageService.delete_file(storage_file)
        except Exception as e:
            db.session.rollback()
            return False, f"Failed to delete document: {str(e)}"

        AuditService.log_event(
            action="DOCUMENT_DELETE",
            actor=user,
            resource_type="Document",
            resource_id=doc_id,
            status="SUCCESS",
            details={"title": doc_title},
        )
        return True, None

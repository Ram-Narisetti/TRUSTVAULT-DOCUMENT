from flask import Blueprint, request, jsonify, g, send_file
from backend.app.services.document_service import DocumentService
from backend.app.services.storage_service import StorageService
from backend.app.services.audit_service import AuditService
from backend.app.security.token_auth import require_auth
from backend.app.security.authorization import AuthorizationService, Action
from backend.app.models.document import Document
from backend.app.extensions import db

documents_bp = Blueprint("documents", __name__, url_prefix="/api/documents")


@documents_bp.route("", methods=["GET"])
@require_auth
def get_documents():
    search = request.args.get("search")
    category = request.args.get("category")
    file_type = request.args.get("file_type")
    sort_by = request.args.get("sort_by", "created_at")
    sort_order = request.args.get("sort_order", "desc")
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    result = DocumentService.get_owned_documents(
        user=g.current_user,
        search=search,
        category=category,
        file_type=file_type,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        per_page=per_page,
    )
    return jsonify(result), 200


@documents_bp.route("/shared", methods=["GET"])
@require_auth
def get_shared_documents():
    search = request.args.get("search")
    category = request.args.get("category")
    file_type = request.args.get("file_type")
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    result = DocumentService.get_shared_with_user(
        user=g.current_user,
        search=search,
        category=category,
        file_type=file_type,
        page=page,
        per_page=per_page,
    )
    return jsonify(result), 200


@documents_bp.route("/search", methods=["GET"])
@require_auth
def search_documents():
    term = request.args.get("q", "").strip()
    docs = DocumentService.search_accessible_documents(g.current_user, term)
    return jsonify({"documents": docs}), 200


@documents_bp.route("/upload", methods=["POST"])
@require_auth
def upload_document():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded in form data."}), 400

    file = request.files["file"]
    title = request.form.get("title", "")
    category = request.form.get("category", "Other")
    description = request.form.get("description", "")

    doc, err = DocumentService.upload_document(
        user=g.current_user,
        file=file,
        title=title,
        category=category,
        description=description,
    )

    if err:
        return jsonify({"error": err}), 400

    return jsonify({"document": doc.to_dict(current_user_id=g.current_user.id)}), 201


@documents_bp.route("/<int:doc_id>", methods=["GET"])
@require_auth
def get_document_details(doc_id: int):
    doc = db.session.get(Document, doc_id)
    if not doc:
        return jsonify({"error": "Document not found."}), 404

    allowed, msg = AuthorizationService.check_document_access(g.current_user, doc, Action.VIEW)
    if not allowed:
        AuditService.log_event(
            action="ACCESS_DENIED",
            actor=g.current_user,
            resource_type="Document",
            resource_id=doc.id,
            status="DENIED",
            details="Unauthorized document view attempt.",
        )
        return jsonify({"error": "You do not have permission to view this document."}), 403

    return jsonify({"document": doc.to_dict(current_user_id=g.current_user.id)}), 200


@documents_bp.route("/<int:doc_id>", methods=["PUT"])
@require_auth
def update_document_metadata(doc_id: int):
    doc = db.session.get(Document, doc_id)
    if not doc:
        return jsonify({"error": "Document not found."}), 404

    data = request.get_json() or {}
    updated_doc, err = DocumentService.update_metadata(g.current_user, doc, data)
    if err:
        status_code = 403 if "permission" in err.lower() or "denied" in err.lower() else 400
        return jsonify({"error": err}), status_code

    return jsonify({"document": updated_doc.to_dict(current_user_id=g.current_user.id)}), 200


@documents_bp.route("/<int:doc_id>", methods=["DELETE"])
@require_auth
def delete_document(doc_id: int):
    doc = db.session.get(Document, doc_id)
    if not doc:
        return jsonify({"error": "Document not found."}), 404

    success, err = DocumentService.delete_document(g.current_user, doc)
    if not success:
        return jsonify({"error": err}), 403

    return jsonify({"message": "Document deleted successfully."}), 200


@documents_bp.route("/<int:doc_id>/preview", methods=["GET"])
@require_auth
def preview_document(doc_id: int):
    doc = db.session.get(Document, doc_id)
    if not doc:
        return jsonify({"error": "Document not found."}), 404

    allowed, msg = AuthorizationService.check_document_access(g.current_user, doc, Action.VIEW)
    if not allowed:
        AuditService.log_event(
            action="ACCESS_DENIED",
            actor=g.current_user,
            resource_type="Document",
            resource_id=doc.id,
            status="DENIED",
            details="Unauthorized document preview attempt.",
        )
        return jsonify({"error": "You do not have permission to preview this document."}), 403

    try:
        file_path = StorageService.get_file_path(doc.storage_filename)
    except Exception as e:
        return jsonify({"error": f"File could not be retrieved: {str(e)}"}), 404

    AuditService.log_event(
        action="DOCUMENT_PREVIEW",
        actor=g.current_user,
        resource_type="Document",
        resource_id=doc.id,
        status="SUCCESS",
        details={"original_filename": doc.original_filename, "size": doc.file_size},
    )

    response = send_file(
        str(file_path),
        as_attachment=False,
        download_name=doc.original_filename,
        mimetype=doc.mime_type,
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@documents_bp.route("/<int:doc_id>/download", methods=["GET"])
@require_auth
def download_document(doc_id: int):
    doc = db.session.get(Document, doc_id)
    if not doc:
        return jsonify({"error": "Document not found."}), 404

    allowed, msg = AuthorizationService.check_document_access(g.current_user, doc, Action.DOWNLOAD)
    if not allowed:
        AuditService.log_event(
            action="ACCESS_DENIED",
            actor=g.current_user,
            resource_type="Document",
            resource_id=doc.id,
            status="DENIED",
            details="Unauthorized document download attempt.",
        )
        return jsonify({"error": "You do not have permission to download this document."}), 403

    try:
        file_path = StorageService.get_file_path(doc.storage_filename)
    except Exception as e:
        return jsonify({"error": f"File could not be retrieved: {str(e)}"}), 404

    AuditService.log_event(
        action="DOCUMENT_DOWNLOAD",
        actor=g.current_user,
        resource_type="Document",
        resource_id=doc.id,
        status="SUCCESS",
        details={"original_filename": doc.original_filename, "size": doc.file_size},
    )

    response = send_file(
        str(file_path),
        as_attachment=True,
        download_name=doc.original_filename,
        mimetype=doc.mime_type,
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Content-Security-Policy"] = "default-src 'none'"
    return response

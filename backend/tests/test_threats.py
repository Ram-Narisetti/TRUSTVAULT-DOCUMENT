import io
from pathlib import Path
from backend.app.models.document import Document
from backend.app.models.permission import DocumentPermission
from backend.app.models.audit_log import AuditLog
from backend.app.services.storage_service import StorageService


def test_threat_18_unauthenticated_requests_rejected(client, db_session):
    """Threat 18: Unauthenticated users cannot access protected APIs."""
    endpoints = [
        ("GET", "/api/documents"),
        ("GET", "/api/documents/shared"),
        ("GET", "/api/system/stats"),
        ("GET", "/api/audit/system"),
        ("POST", "/api/documents/upload"),
    ]
    for method, url in endpoints:
        resp = client.open(url, method=method)
        assert resp.status_code == 401
        assert "Authentication token is required" in resp.get_json()["error"]


def test_threat_13_no_public_admin_registration(client, db_session):
    """Threat 13: Users cannot self-promote to admin via registration."""
    payload = {
        "email": "hacker@evil.com",
        "username": "hacker",
        "full_name": "Hacker Person",
        "password": "SecurePassword123!",
        "role": "admin",  # Attacker attempts role spoofing
    }
    resp = client.post("/api/auth/register", json=payload)
    assert resp.status_code == 201
    user_data = resp.get_json()["user"]
    # Server MUST force role to 'owner' regardless of payload input
    assert user_data["role"] == "owner"


def test_threat_01_and_02_owner_isolation_and_idor(client, test_users, auth_headers, db_session):
    """Threat 1 & 2: IDOR defense and owner-to-owner isolation."""
    owner_a = test_users["owner_a"]
    owner_b = test_users["owner_b"]

    # Owner A uploads a document
    file_content = b"%PDF-1.4 test document content"
    data = {
        "file": (io.BytesIO(file_content), "contract_a.pdf"),
        "title": "Owner A Secret Contract",
        "category": "Legal",
    }
    resp_upload = client.post(
        "/api/documents/upload",
        data=data,
        content_type="multipart/form-data",
        headers=auth_headers(owner_a),
    )
    assert resp_upload.status_code == 201
    doc_id = resp_upload.get_json()["document"]["id"]

    # Owner B attempts to view details of Owner A's document
    resp_view = client.get(f"/api/documents/{doc_id}", headers=auth_headers(owner_b))
    assert resp_view.status_code == 403

    # Owner B attempts to edit metadata of Owner A's document
    resp_edit = client.put(
        f"/api/documents/{doc_id}",
        json={"title": "Hacked Title", "category": "Legal"},
        headers=auth_headers(owner_b),
    )
    assert resp_edit.status_code == 403

    # Owner B attempts to delete Owner A's document
    resp_delete = client.delete(f"/api/documents/{doc_id}", headers=auth_headers(owner_b))
    assert resp_delete.status_code == 403

    # Owner B attempts to download Owner A's document
    resp_download = client.get(f"/api/documents/{doc_id}/download", headers=auth_headers(owner_b))
    assert resp_download.status_code == 403

    # Verify database was NOT modified
    doc = db_session.session.get(Document, doc_id)
    assert doc.title == "Owner A Secret Contract"


def test_threat_03_viewer_cannot_mutate_or_delete(client, test_users, auth_headers, db_session):
    """Threat 3: Viewer cannot edit metadata, delete, or upload documents."""
    owner_a = test_users["owner_a"]
    viewer_a = test_users["viewer_a"]

    # Viewer cannot upload documents
    resp_upload = client.post(
        "/api/documents/upload",
        data={"file": (io.BytesIO(b"%PDF-1.4 sample"), "test.pdf"), "category": "Work"},
        content_type="multipart/form-data",
        headers=auth_headers(viewer_a),
    )
    assert resp_upload.status_code == 400 or resp_upload.status_code == 403

    # Owner A uploads a document and grants VIEW permission to Viewer A
    upload = client.post(
        "/api/documents/upload",
        data={"file": (io.BytesIO(b"%PDF-1.4 shared sample"), "financial_report.pdf"), "category": "Finance"},
        content_type="multipart/form-data",
        headers=auth_headers(owner_a),
    )
    doc_id = upload.get_json()["document"]["id"]

    share_resp = client.post(
        f"/api/documents/{doc_id}/permissions",
        json={"recipient_email": viewer_a.email, "permission": "VIEW"},
        headers=auth_headers(owner_a),
    )
    assert share_resp.status_code == 201

    # Viewer A can view and download
    assert client.get(f"/api/documents/{doc_id}", headers=auth_headers(viewer_a)).status_code == 200
    assert client.get(f"/api/documents/{doc_id}/download", headers=auth_headers(viewer_a)).status_code == 200

    # Viewer A CANNOT edit metadata
    edit_resp = client.put(
        f"/api/documents/{doc_id}",
        json={"title": "Altered by viewer", "category": "Finance"},
        headers=auth_headers(viewer_a),
    )
    assert edit_resp.status_code == 403

    # Viewer A CANNOT delete document
    del_resp = client.delete(f"/api/documents/{doc_id}", headers=auth_headers(viewer_a))
    assert del_resp.status_code == 403


def test_threat_04_and_05_viewer_cannot_admin_or_share(client, test_users, auth_headers, db_session):
    """Threat 4 & 5: Viewer cannot access admin endpoints or manage permissions."""
    owner_a = test_users["owner_a"]
    viewer_a = test_users["viewer_a"]
    viewer_b = test_users["viewer_b"]

    # Viewer A cannot access admin endpoints
    assert client.get("/api/system/stats", headers=auth_headers(viewer_a)).status_code == 403
    assert client.get("/api/audit/system", headers=auth_headers(viewer_a)).status_code == 403
    assert client.get("/api/users", headers=auth_headers(viewer_a)).status_code == 403

    # Owner A uploads document and shares with Viewer A
    upload = client.post(
        "/api/documents/upload",
        data={"file": (io.BytesIO(b"%PDF-1.4 report"), "doc.pdf"), "category": "Work"},
        content_type="multipart/form-data",
        headers=auth_headers(owner_a),
    )
    doc_id = upload.get_json()["document"]["id"]

    client.post(
        f"/api/documents/{doc_id}/permissions",
        json={"recipient_email": viewer_a.email, "permission": "EDIT"},
        headers=auth_headers(owner_a),
    )

    # Viewer A attempts to grant permission to Viewer B
    share_attempt = client.post(
        f"/api/documents/{doc_id}/permissions",
        json={"recipient_email": viewer_b.email, "permission": "VIEW"},
        headers=auth_headers(viewer_a),
    )
    assert share_attempt.status_code == 403

    # Viewer A attempts to inspect permission grant list
    inspect_attempt = client.get(
        f"/api/documents/{doc_id}/permissions",
        headers=auth_headers(viewer_a),
    )
    assert inspect_attempt.status_code == 403


def test_threat_06_and_07_revocation_blocks_download_immediately(client, test_users, auth_headers, db_session):
    """Threat 6 & 7: Access after revocation is blocked immediately without delay."""
    owner_a = test_users["owner_a"]
    viewer_a = test_users["viewer_a"]

    # Upload document
    upload = client.post(
        "/api/documents/upload",
        data={"file": (io.BytesIO(b"%PDF-1.4 secret doc"), "sensitive.pdf"), "category": "Finance"},
        content_type="multipart/form-data",
        headers=auth_headers(owner_a),
    )
    doc_id = upload.get_json()["document"]["id"]

    # Grant access to Viewer A
    client.post(
        f"/api/documents/{doc_id}/permissions",
        json={"recipient_email": viewer_a.email, "permission": "VIEW"},
        headers=auth_headers(owner_a),
    )

    # Viewer A can download
    resp1 = client.get(f"/api/documents/{doc_id}/download", headers=auth_headers(viewer_a))
    assert resp1.status_code == 200

    # Owner A revokes access
    revoke_resp = client.delete(
        f"/api/documents/{doc_id}/permissions/{viewer_a.id}",
        headers=auth_headers(owner_a),
    )
    assert revoke_resp.status_code == 200

    # Viewer A tries to download immediately after revocation
    resp2 = client.get(f"/api/documents/{doc_id}/download", headers=auth_headers(viewer_a))
    assert resp2.status_code == 403

    # Viewer A tries to view details
    resp3 = client.get(f"/api/documents/{doc_id}", headers=auth_headers(viewer_a))
    assert resp3.status_code == 403


def test_threat_08_malicious_file_uploads_rejected(client, test_users, auth_headers, db_session):
    """Threat 8: Executable files and MIME/magic-byte spoofing are rejected."""
    owner_a = test_users["owner_a"]

    # Executable file extension
    resp_exe = client.post(
        "/api/documents/upload",
        data={"file": (io.BytesIO(b"MZ\x90\x00malicious binary"), "payload.exe"), "category": "Other"},
        content_type="multipart/form-data",
        headers=auth_headers(owner_a),
    )
    assert resp_exe.status_code == 400
    assert "strictly prohibited" in resp_exe.get_json()["error"]

    # Python script extension
    resp_py = client.post(
        "/api/documents/upload",
        data={"file": (io.BytesIO(b"print('hack')"), "exploit.py"), "category": "Other"},
        content_type="multipart/form-data",
        headers=auth_headers(owner_a),
    )
    assert resp_py.status_code == 400

    # Fake PDF: named .pdf but containing arbitrary text without %PDF magic bytes
    resp_fake_pdf = client.post(
        "/api/documents/upload",
        data={"file": (io.BytesIO(b"This is not a real PDF file!"), "spoofed.pdf"), "category": "Other"},
        content_type="multipart/form-data",
        headers=auth_headers(owner_a),
    )
    assert resp_fake_pdf.status_code == 400
    assert "signature" in resp_fake_pdf.get_json()["error"]


def test_threat_09_path_traversal_defense(client, test_users, auth_headers, db_session, app):
    """Threat 9: Filename and path traversal attacks do not escape storage directory."""
    owner_a = test_users["owner_a"]

    malicious_filename = "../../../../etc/passwd.txt"
    resp = client.post(
        "/api/documents/upload",
        data={"file": (io.BytesIO(b"root:x:0:0:root:/root:/bin/bash"), malicious_filename), "category": "Other"},
        content_type="multipart/form-data",
        headers=auth_headers(owner_a),
    )
    assert resp.status_code == 201
    saved_doc = resp.get_json()["document"]

    # Storage filename must be randomized and clean, never user's path traversal string
    doc_record = db_session.session.get(Document, saved_doc["id"])
    assert ".." not in doc_record.storage_filename
    assert "/" not in doc_record.storage_filename
    assert "\\" not in doc_record.storage_filename

    # Stored file must reside safely inside UPLOAD_FOLDER
    file_path = StorageService.get_file_path(doc_record.storage_filename)
    upload_dir = Path(app.config["UPLOAD_FOLDER"]).resolve()
    assert str(file_path).startswith(str(upload_dir))


def test_threat_11_user_enumeration_prevention(client, db_session):
    """Threat 11: Authentication errors do not leak whether an account exists."""
    # Attempt with non-existent email
    resp1 = client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "Password123!"})
    assert resp1.status_code == 401
    err1 = resp1.get_json()["error"]

    # Register an actual user
    client.post("/api/auth/register", json={
        "email": "realuser@example.com",
        "username": "realuser",
        "full_name": "Real User",
        "password": "Password123!",
    })

    # Attempt with real email but wrong password
    resp2 = client.post("/api/auth/login", json={"email": "realuser@example.com", "password": "WrongPassword99!"})
    assert resp2.status_code == 401
    err2 = resp2.get_json()["error"]

    # Both errors must be identical to mitigate user enumeration
    assert err1 == err2 == "Invalid email or password."


def test_threat_12_deactivated_user_blocked_immediately(client, test_users, auth_headers, db_session):
    """Threat 12: Inactive or deactivated users are denied access immediately."""
    owner_a = test_users["owner_a"]
    headers = auth_headers(owner_a)

    # User can access currently
    resp_active = client.get("/api/auth/me", headers=headers)
    assert resp_active.status_code == 200

    # Admin deactivates Owner A
    owner_a.is_active = False
    db_session.session.commit()

    # Owner A tries to use existing active token
    resp_inactive = client.get("/api/auth/me", headers=headers)
    assert resp_inactive.status_code == 403
    assert "deactivated" in resp_inactive.get_json()["error"].lower()


def test_threat_14_and_15_audit_logs_and_access_control(client, test_users, auth_headers, db_session):
    """Threat 14 & 15: Security events recorded; non-admins cannot read system audit logs."""
    admin_a = test_users["admin_a"]
    owner_a = test_users["owner_a"]
    viewer_a = test_users["viewer_a"]

    # Admin can view system logs
    admin_resp = client.get("/api/audit/system", headers=auth_headers(admin_a))
    assert admin_resp.status_code == 200
    assert "logs" in admin_resp.get_json()

    # Owner and Viewer CANNOT view system logs
    assert client.get("/api/audit/system", headers=auth_headers(owner_a)).status_code == 403
    assert client.get("/api/audit/system", headers=auth_headers(viewer_a)).status_code == 403

    # Verify audit logs captured events
    logs = AuditLog.query.all()
    assert len(logs) > 0


def test_threat_16_safe_file_cleanup_on_deletion(client, test_users, auth_headers, db_session, app):
    """Threat 16: Physical storage file is deleted when document is deleted (no orphan files)."""
    owner_a = test_users["owner_a"]

    # Upload document
    resp = client.post(
        "/api/documents/upload",
        data={"file": (io.BytesIO(b"%PDF-1.4 delete test content"), "to_delete.pdf"), "category": "Work"},
        content_type="multipart/form-data",
        headers=auth_headers(owner_a),
    )
    doc_id = resp.get_json()["document"]["id"]
    doc = db_session.session.get(Document, doc_id)
    storage_name = doc.storage_filename

    file_path = StorageService.get_file_path(storage_name)
    assert file_path.exists()

    # Delete document
    del_resp = client.delete(f"/api/documents/{doc_id}", headers=auth_headers(owner_a))
    assert del_resp.status_code == 200

    # Verify physical file is cleanly unlinked from disk
    assert not file_path.exists()
    assert db_session.session.get(Document, doc_id) is None


def test_threat_17_token_revocation_on_logout(client, test_users, auth_headers, db_session):
    """Threat 17: Logged out tokens are immediately revoked."""
    owner_a = test_users["owner_a"]
    headers = auth_headers(owner_a)

    # Token works initially
    assert client.get("/api/auth/me", headers=headers).status_code == 200

    # User logs out
    logout_resp = client.post("/api/auth/logout", headers=headers)
    assert logout_resp.status_code == 200

    # Old token is now rejected
    after_resp = client.get("/api/auth/me", headers=headers)
    assert after_resp.status_code == 401
    assert "revoked" in after_resp.get_json()["error"].lower()


def test_threat_03b_edit_grant_allows_metadata_update_only(client, test_users, auth_headers, db_session):
    """Verify EDIT permission level allows editing metadata but forbids delete and re-sharing."""
    owner_a = test_users["owner_a"]
    viewer_a = test_users["viewer_a"]
    viewer_b = test_users["viewer_b"]

    upload = client.post(
        "/api/documents/upload",
        data={"file": (io.BytesIO(b"%PDF-1.4 edit doc"), "edit_test.pdf"), "category": "Work"},
        content_type="multipart/form-data",
        headers=auth_headers(owner_a),
    )
    doc_id = upload.get_json()["document"]["id"]

    # Grant EDIT permission to Viewer A
    client.post(
        f"/api/documents/{doc_id}/permissions",
        json={"recipient_email": viewer_a.email, "permission": "EDIT"},
        headers=auth_headers(owner_a),
    )

    # Viewer A CAN update metadata with EDIT grant
    edit_resp = client.put(
        f"/api/documents/{doc_id}",
        json={"title": "Updated Title by Editor", "category": "Work", "description": "Edited"},
        headers=auth_headers(viewer_a),
    )
    assert edit_resp.status_code == 200
    doc = db_session.session.get(Document, doc_id)
    assert doc.title == "Updated Title by Editor"

    # Viewer A CANNOT delete document even with EDIT grant
    del_resp = client.delete(f"/api/documents/{doc_id}", headers=auth_headers(viewer_a))
    assert del_resp.status_code == 403

    # Viewer A CANNOT share or grant permissions to Viewer B
    share_resp = client.post(
        f"/api/documents/{doc_id}/permissions",
        json={"recipient_email": viewer_b.email, "permission": "VIEW"},
        headers=auth_headers(viewer_a),
    )
    assert share_resp.status_code == 403


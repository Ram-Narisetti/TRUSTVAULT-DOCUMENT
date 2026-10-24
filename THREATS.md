# TrustVault — Comprehensive Threat Model & Security Matrix

TrustVault is an enterprise-grade document management and access control platform engineered around the principle of **zero trust** and **server-side authorization enforcement**.

This document models the trust boundaries, threat actors, attack vectors, mitigations, and automated verification tests for the TrustVault system.

---

## 1. System Architecture & Trust Boundaries

```
[ Untrusted Client / Browser ]
         │  HTTPS / JSON API
         ▼
[ Flask Security Perimeter ]
  ├─ Rate Limiting (Flask-Limiter)
  ├─ CORS & Strict Security Headers (nosniff, DENY, CSP)
  ├─ Input Sanitization & Request Validation
  └─ Authentication Layer (JWT with Revocation + Active Check)
         │
         ▼
[ Centralized Authorization Engine (AuthorizationService) ]
  ├─ Deny by Default
  ├─ Global Role Enforcement (Admin, Owner, Viewer)
  ├─ Per-Document Access Grants (OWNER, EDIT, VIEW)
  └─ Append-Only Audit Logging (AuditService)
         │
         ├───▶ [ Database (SQLAlchemy / SQLite / PostgreSQL) ]
         │      ├─ Users & Passwords (scrypt hash)
         │      ├─ Documents & Cryptographic Hashes (SHA-256)
         │      ├─ DocumentPermissions (Granular ACLs)
         │      ├─ RevokedTokens (Immediate Session Invalidation)
         │      └─ AuditLogs (Append-Only Event Ledger)
         │
         └───▶ [ Private Storage File System (Outside Web Root) ]
                ├─ Randomized UUID Filenames (prevents traversal & guessing)
                ├─ Magic-Bytes Signature Validation
                └─ Traversal Guards (abspath commonpath verification)
```

---

## 2. Threat Actor Taxonomy

1. **Unauthenticated External Attacker**: Can send arbitrary HTTP requests, tamper with parameters, brute-force credentials, or guess document identifiers.
2. **Malicious Viewer**: Has a legitimate account with `viewer` role; seeks to elevate to owner/admin, view unshared documents, edit metadata, delete files, or share documents with third parties.
3. **Malicious / Disgruntled Owner**: Has legitimate document authoring capabilities; attempts horizontal privilege escalation to access, tamper with, or delete documents belonging to another owner.
4. **Deactivated Former Employee**: Possesses previously valid credentials or session tokens; seeks to access documents after access has been revoked.

---

## 3. Threat Matrix & Automated Verification

### Threat 1: Insecure Direct Object Reference (IDOR) through Guessed Document IDs
- **Asset Affected:** Confidential documents and metadata.
- **Attacker Capability:** Attacker guesses or enumerates sequential or random document IDs (`/api/documents/42`).
- **Attack Path:** Sends `GET /api/documents/<target_id>` or `GET /api/documents/<target_id>/download`.
- **Expected Behavior:** System verifies whether the authenticated user is the document owner or has an active grant in `DocumentPermission`. If neither, access is strictly blocked with `403 Forbidden` and logged as `ACCESS_DENIED`.
- **Implemented Mitigation:** `AuthorizationService.check_document_access()` validates caller identity on every endpoint. No document or file stream is returned without explicit authorization.
- **Automated Test:** `backend/tests/test_threats.py::test_threat_01_and_02_owner_isolation_and_idor`
- **Residual Risk:** Low. Document UUIDs are also supported for external references.

---

### Threat 2: Owner-to-Owner Privilege Escalation (Horizontal Escalation)
- **Asset Affected:** Segregation between distinct document owners.
- **Attacker Capability:** Authenticated Owner B attempts to modify, share, or delete Owner A's files.
- **Attack Path:** Owner B sends `PUT /api/documents/<doc_a_id>` or `DELETE /api/documents/<doc_a_id>`.
- **Expected Behavior:** Operation rejected with `403 Forbidden`. Database records and disk files remain completely unchanged.
- **Implemented Mitigation:** `DocumentService.update_metadata()` and `DocumentService.delete_document()` invoke `AuthorizationService` to ensure `doc.owner_id == caller.id`.
- **Automated Test:** `backend/tests/test_threats.py::test_threat_01_and_02_owner_isolation_and_idor`
- **Residual Risk:** None identified.

---

### Threat 3: Viewer-to-Owner Privilege Escalation (Vertical Escalation)
- **Asset Affected:** Document ownership and modification integrity.
- **Attacker Capability:** A viewer with `VIEW` grant attempts to edit metadata, upload files, or delete documents.
- **Attack Path:** Viewer sends `PUT /api/documents/<id>` or `DELETE /api/documents/<id>`.
- **Expected Behavior:** Rejected with `403 Forbidden` and logged in audit trail.
- **Implemented Mitigation:** Separate permissions model: `VIEW` grants only read/download. Mutation operations require `Action.EDIT_METADATA` or `Action.DELETE` (owner only).
- **Automated Test:** `backend/tests/test_threats.py::test_threat_03_viewer_cannot_mutate_or_delete`
- **Residual Risk:** None identified.

---

### Threat 4: Viewer-to-Admin Privilege Escalation
- **Asset Affected:** Administrative console, system telemetry, and global audit logs.
- **Attacker Capability:** Viewer or non-admin user calls `/api/system/stats`, `/api/audit/system`, or `/api/users`.
- **Attack Path:** Direct API requests to administrative blueprint routes.
- **Expected Behavior:** Return `403 Forbidden` with `"You do not have permission to perform this action."`.
- **Implemented Mitigation:** `@require_role('admin')` decorator verifies role from database record on each request and records `ACCESS_DENIED` in audit logs.
- **Automated Test:** `backend/tests/test_threats.py::test_threat_04_and_05_viewer_cannot_admin_or_share`
- **Residual Risk:** None identified.

---

### Threat 5: Unauthorized Document Downloads through Guessable URLs
- **Asset Affected:** File content stored on disk.
- **Attacker Capability:** Attacker attempts to download private files directly using guessed file paths or document IDs.
- **Attack Path:** Requests `/uploads/<filename>` or `/api/documents/<id>/download`.
- **Expected Behavior:** No raw file URL is publicly accessible. All downloads must pass through `/api/documents/<id>/download` where authorization is verified before `send_file`.
- **Implemented Mitigation:** Storage directory is stored completely outside the public web root. Files are delivered via streaming Flask controller with `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, and `Content-Security-Policy: default-src 'none'`.
- **Automated Test:** `backend/tests/test_threats.py::test_threat_01_and_02_owner_isolation_and_idor` & `test_threat_06_and_07_revocation_blocks_download_immediately`
- **Residual Risk:** None identified.

---

### Threat 6: Unauthorized Access After Permission Revocation
- **Asset Affected:** Continued access to confidential files.
- **Attacker Capability:** A recipient retains an active token or cached link and tries to download after the owner revokes access.
- **Attack Path:** Owner calls `DELETE /api/documents/<id>/permissions/<user_id>`. Recipient calls `GET /api/documents/<id>/download`.
- **Expected Behavior:** Immediate denial (`403 Forbidden`) on the very next request. No caching window.
- **Implemented Mitigation:** Revocation deletes the database `DocumentPermission` record within a transaction. The download endpoint queries current permission status directly from the database on every download.
- **Automated Test:** `backend/tests/test_threats.py::test_threat_06_and_07_revocation_blocks_download_immediately`
- **Residual Risk:** User might have already downloaded a copy before revocation (mitigated by offline DRM outside scope of web application).

---

### Threat 7: Malicious File Upload (Web Shells / Executables)
- **Asset Affected:** Host server execution integrity and client safety.
- **Attacker Capability:** Attacker uploads `.php`, `.py`, `.sh`, `.exe`, or a polyglot file to achieve Remote Code Execution (RCE).
- **Attack Path:** `POST /api/documents/upload` with executable attachment.
- **Expected Behavior:** Rejection with `400 Bad Request` and error message indicating executable files are prohibited.
- **Implemented Mitigation:**
  1. Strict allowlist (`pdf`, `docx`, `xlsx`, `pptx`, `txt`, `csv`, `png`, `jpg`).
  2. Blocklist of dangerous extensions (`.exe`, `.sh`, `.py`, `.js`, etc.).
  3. Magic-bytes signature inspection (`%PDF`, `PK\x03\x04`, `\x89PNG`, `\xFF\xD8\xFF`).
  4. Binary null-byte checks on text files.
  5. Storage file is assigned a random `uuid.uuid4().hex` name without executing permissions.
- **Automated Test:** `backend/tests/test_threats.py::test_threat_08_malicious_file_uploads_rejected`
- **Residual Risk:** Zero-day vulnerabilities inside external PDF viewers on client machines.

---

### Threat 8: Filename & Path Traversal Attacks
- **Asset Affected:** Host file system.
- **Attacker Capability:** Attacker provides filenames containing `../../../../etc/passwd` or `..\..\windows\win.ini`.
- **Attack Path:** Attacker tampers with filename parameter during multipart upload or retrieval.
- **Expected Behavior:** File is saved inside the configured upload folder under a random UUID. User-supplied path characters are completely stripped.
- **Implemented Mitigation:**
  1. `werkzeug.utils.secure_filename()` strips directory traversal tokens.
  2. The server generates a random UUID filename for disk storage.
  3. `StorageService.get_file_path()` checks `str(path).startswith(str(upload_folder))` using `os.path.abspath`.
- **Automated Test:** `backend/tests/test_threats.py::test_threat_09_path_traversal_defense`
- **Residual Risk:** None identified.

---

### Threat 9: Brute-Force Login & Credential Stuffing
- **Asset Affected:** User authentication endpoint.
- **Attacker Capability:** Attacker fires thousands of automated password guesses against `/api/auth/login`.
- **Attack Path:** Automated script sends rapid `POST /api/auth/login`.
- **Expected Behavior:** Throttling returns `429 Too Many Requests`.
- **Implemented Mitigation:** Flask-Limiter configured with `15/minute` on `/api/auth/login` and `10/minute` on `/api/auth/register`.
- **Automated Test:** Configured in `backend/app/api/auth.py`.
- **Residual Risk:** Distributed botnets using rotating IPs (recommend Cloudflare / WAF in production).

---

### Threat 10: Session Theft and CSRF
- **Asset Affected:** Authenticated user sessions.
- **Attacker Capability:** Cross-site malicious website attempts to force authenticated actions.
- **Attack Path:** Malicious site embeds script requesting `POST /api/documents/<id>/permissions`.
- **Expected Behavior:** Cross-site request rejected.
- **Implemented Mitigation:**
  1. Tokens are passed in custom HTTP header `Authorization: Bearer <token>`. Browsers do not attach custom headers to cross-origin requests without CORS approval.
  2. CORS policy restricts origins to trusted whitelist (`CORS_ORIGINS`).
  3. Revoked token table enables instantaneous logout session termination.
- **Automated Test:** `backend/tests/test_threats.py::test_threat_17_token_revocation_on_logout`
- **Residual Risk:** XSS on client browser could steal localStorage tokens (mitigated by strict React JSX escaping and Content-Security-Policy).

---

### Threat 11: Unauthorized Audit Log Access
- **Asset Affected:** System-wide activity history, user emails, IP addresses.
- **Attacker Capability:** Viewer or Owner calls `/api/audit/system`.
- **Attack Path:** `GET /api/audit/system`.
- **Expected Behavior:** `403 Forbidden` response.
- **Implemented Mitigation:** Admin role enforcement on `/api/audit/system`. Regular owners can only access `/api/audit/my-documents` which filters strictly on documents where `owner_id == current_user.id`.
- **Automated Test:** `backend/tests/test_threats.py::test_threat_14_and_15_audit_logs_and_access_control`
- **Residual Risk:** None identified.

---

### Threat 12: User Enumeration
- **Asset Affected:** Privacy of registered user emails.
- **Attacker Capability:** Attacker submits emails to login to determine whether an account exists.
- **Attack Path:** Submits registered vs unregistered email to login.
- **Expected Behavior:** Equal response timing and identical error message: `"Invalid email or password."`.
- **Implemented Mitigation:** `AuthService.login()` executes a dummy `check_password_hash` on a precomputed scrypt hash when user is not found, equalizing execution time and returning identical error text.
- **Automated Test:** `backend/tests/test_threats.py::test_threat_11_user_enumeration_prevention`
- **Residual Risk:** Registration endpoint returns account collision notice if email already exists.

---

### Threat 13: Unauthorized Metadata Edits and Deletions
- **Asset Affected:** Document metadata and availability.
- **Attacker Capability:** Shared user with `VIEW` permission sends `PUT` or `DELETE` requests.
- **Attack Path:** Direct API calls to `/api/documents/<id>`.
- **Expected Behavior:** `403 Forbidden` response; database record unaffected.
- **Implemented Mitigation:** `AuthorizationService` distinguishes `VIEW` from `EDIT`. Deletions require `OWNER`.
- **Automated Test:** `backend/tests/test_threats.py::test_threat_03_viewer_cannot_mutate_or_delete` & `test_threat_03b_edit_grant_allows_metadata_update_only`
- **Residual Risk:** None identified.

---

### Threat 14: Insecure Admin Account Provisioning & Self-Promotion
- **Asset Affected:** Administrator privilege assignment.
- **Attacker Capability:** Attacker sends `{"role": "admin"}` in registration payload.
- **Attack Path:** `POST /api/auth/register` with role override.
- **Expected Behavior:** Server forces role to `'owner'`. Admin role is never assigned publicly.
- **Implemented Mitigation:** `AuthService.register()` explicitly ignores incoming role and sets `role="owner"`. Admin accounts can only be created via the protected CLI command `flask create-admin`.
- **Automated Test:** `backend/tests/test_threats.py::test_threat_13_no_public_admin_registration`
- **Residual Risk:** None identified.

---

### Threat 15: Information Leakage Through Server Errors
- **Asset Affected:** Server internals, file system paths, stack traces.
- **Attacker Capability:** Attacker sends malformed payloads to trigger uncaught 500 exceptions.
- **Attack Path:** Submitting corrupted form data or invalid JSON.
- **Expected Behavior:** Centralized error handlers return generic JSON responses without stack traces.
- **Implemented Mitigation:** Custom `@app.errorhandler` for 400, 404, 405, 413, 429, and 500 returning standardized error JSON. Production `DEBUG=False`.
- **Automated Test:** Verified by API client tests.
- **Residual Risk:** None identified.

---

### Threat 16: Race Conditions During Sharing or Revocation
- **Asset Affected:** Permission grant consistency.
- **Attacker Capability:** Rapid concurrent grant and revoke calls.
- **Attack Path:** Concurrent requests modifying permissions.
- **Expected Behavior:** Database transactions ensure serialized updates.
- **Implemented Mitigation:** Unique database constraint `uq_doc_user_permission` on `(document_id, user_id)` and explicit transaction commits/rollbacks in `PermissionService`.
- **Automated Test:** Covered by permission uniqueness and revocation tests.
- **Residual Risk:** High-volume concurrent writes require row-level locking in PostgreSQL production.

---

### Threat 17: Exposure of Secrets through Git or Config
- **Asset Affected:** Application secret keys, database credentials.
- **Attacker Capability:** Public repository scraping.
- **Attack Path:** Checking repository history for `.env` or hardcoded tokens.
- **Expected Behavior:** Zero secrets in source code; `.env` listed in `.gitignore`.
- **Implemented Mitigation:** `.env.example` contains placeholders only; secrets are read from environment via `python-dotenv`. Comprehensive `.gitignore` ignores `.env`, databases, and upload directories.
- **Automated Test:** Repository static scan.
- **Residual Risk:** Accidental user commit (mitigated by pre-commit hooks).

---

### Threat 18: Account Deactivation and Stale-Session Access
- **Asset Affected:** Access after employee termination or suspension.
- **Attacker Capability:** Deactivated user presents an unexpired JWT token.
- **Attack Path:** Calls protected endpoints with pre-existing token.
- **Expected Behavior:** Immediate rejection with `403 Forbidden: Your account has been deactivated.`
- **Implemented Mitigation:** `@require_auth` decorates all protected endpoints and performs a live database check on `user.is_active`. If `False`, request is blocked immediately regardless of token signature validity.
- **Automated Test:** `backend/tests/test_threats.py::test_threat_12_deactivated_user_blocked_immediately`
- **Residual Risk:** None identified.

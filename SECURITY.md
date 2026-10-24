# TrustVault Security Policy & Architecture

TrustVault is engineered with a **defense-in-depth security model** prioritizing fail-closed authorization, data integrity, and strict access isolation.

---

## 1. Authentication Model

TrustVault implements a stateless signed token mechanism coupled with server-side revocation tracking:

1. **Password Hashing:**
   - Passwords are hashed using **scrypt** (`werkzeug.security.generate_password_hash(method='scrypt')`), a memory-hard key derivation function recommended by NIST and OWASP for high resistance to GPU/ASIC offline attacks.
   - Plaintext passwords are never stored, logged, or serialized.
2. **Token Format:**
   - JWT signed with `HS256` using a 256-bit+ secret key.
   - Contains claims: `sub` (user ID string), `email`, `role`, `jti` (unique UUID), `iat`, and `exp`.
3. **Session Revocation:**
   - On logout, the token's unique identifier (`jti`) is added to the `revoked_tokens` table until expiration.
   - On every authenticated API request, the `@require_auth` decorator checks:
     1. Signature validity and token expiration.
     2. `RevokedToken` table lookup for token `jti`.
     3. Active user check in the database (`user.is_active == True`).
   - If an administrator deactivates a user, all active sessions for that user are **immediately terminated** without waiting for token expiration.

---

## 2. Role and Permission Matrix

TrustVault enforces a clean separation between **Global User Roles** and **Per-Document Access Grants**:

### Global User Roles
| Role | Capabilities | Restrictions |
| :--- | :--- | :--- |
| **Admin** | System telemetry dashboard, user account activation/deactivation, system audit logs, compliance oversight. | Cannot modify or delete non-owned documents without explicit documented policy. Cannot self-register. |
| **Owner** | Upload files, manage owned documents, update metadata, delete owned files, grant and revoke access to other users. | Cannot access administrative consoles or system-wide audit logs. Cannot manage other owners' documents. |
| **Viewer** | View documents explicitly shared with them, download files where granted, update metadata only if granted `EDIT`. | Cannot upload documents, delete files, share documents, access admin pages, or view system logs. |

### Document-Level Permissions
| Permission Level | Read Metadata | Download File | Edit Metadata | Delete Document | Grant / Revoke Access |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **OWNER** | Yes | Yes | Yes | Yes | Yes |
| **EDIT** | Yes | Yes | Yes | No | No |
| **VIEW** | Yes | Yes | No | No | No |
| **NONE** | No (403/404) | No (403/404) | No (403/404) | No (403/404) | No (403/404) |

---

## 3. Document Authorization Flow

Every request for document operations follows this strict sequential evaluation in `AuthorizationService.check_document_access()`:

```
[ Incoming Request ]
        │
        ▼
Step 1: Authenticate caller token & verify `user.is_active == True`.
        │ (Fail ➔ 401 Unauthorized or 403 Forbidden)
        ▼
Step 2: Fetch target document record from database.
        │ (Missing ➔ 404 Not Found)
        ▼
Step 3: Check Document Ownership:
        Is `document.owner_id == user.id`?
        ├─▶ YES ➔ Allow operation (OWNER level authority).
        └─▶ NO  ➔ Proceed to Step 4.
        ▼
Step 4: Check Explicit Document Grants:
        Query `DocumentPermission` for `(document_id, user.id)`.
        ├─▶ Grant found:
        │     ├─ Action == VIEW or DOWNLOAD: Allowed.
        │     ├─ Action == EDIT_METADATA: Allowed only if `permission_level == 'EDIT'`.
        │     └─ Action in (DELETE, SHARE, REVOKE): DENIED (Owner only).
        └─▶ No grant found:
              └─▶ DENIED. (Record `ACCESS_DENIED` in `AuditLog` and return 403).
```

---

## 4. Upload and Download File Security

1. **Private Storage Outside Web Root:**
   - Uploaded files are stored in `backend/uploads/` (or configured private object storage), completely outside the HTTP document root.
   - No direct web server URL maps to any file.
2. **Randomized Storage Filenames:**
   - Every saved file is given a UUIDv4 filename (e.g. `a6d13c...9b.pdf`). The user's original filename is sanitized and stored only as database metadata.
3. **Magic-Bytes File Signature Verification:**
   - Files are validated not only by extension, but by verifying their file header bytes:
     - PDF: `%PDF`
     - PNG: `\x89PNG\r\n\x1a\n`
     - JPEG: `\xFF\xD8\xFF`
     - Office Open XML: `PK\x03\x04`
     - Text / CSV: Verified UTF-8/ASCII without binary null bytes.
   - Executable extensions (`.exe`, `.sh`, `.bat`, `.py`, `.js`, `.dll`, etc.) are unconditionally rejected.
4. **Path Traversal Guards:**
   - Both uploads and downloads calculate the absolute canonical path (`Path.resolve()`) and confirm it resides strictly inside the configured `UPLOAD_FOLDER`.
5. **Cryptographic Integrity (SHA-256):**
   - The SHA-256 hash is computed in streaming chunks during upload and stored in the database.
   - Users can verify file integrity and detect unauthorized out-of-band file tampering.
6. **Download Security Headers:**
   - Served with `Content-Disposition: attachment; filename="<sanitized>"`.
   - `X-Content-Type-Options: nosniff` prevents browser MIME-sniffing.
   - `Content-Security-Policy: default-src 'none'` neutralizes inline script execution.

---

## 5. Security Testing

Run the automated security test suite:

```bash
# Activate virtual environment
.\venv\Scripts\activate   # Windows
source venv/bin/activate  # Linux/macOS

# Run Pytest with verbose output
pytest -v
```

The test suite exercises real database fixtures and file streams covering IDOR, horizontal/vertical escalation, immediate revocation, path traversal, malicious upload rejection, user enumeration defense, and audit logging.

---

## 6. Incident Response & Tamper Resistance

1. **Append-Only Audit Logs:**
   - Every authentication attempt, file upload, file download, permission change, and blocked access attempt is logged to the `audit_logs` table.
   - Logs include UTC timestamp, actor email, action, resource, outcome status, remote IP, and client User-Agent.
   - Sensitive fields (passwords, tokens, file contents) are explicitly redacted.
2. **Limitation of In-Database Logs:**
   - In single-database deployments, an attacker with root database access could alter records. For production deployments, audit logs should be streamed to an immutable external SIEM (e.g., AWS CloudWatch, Google Cloud Logging, or Splunk).

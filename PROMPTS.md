# TrustVault — AI-Assisted Development & Engineering Record

This document provides an honest, transparent engineering record of AI-assisted development during the creation of **TrustVault**, including architectural decisions, prompt iterations, corrections made, and security test verifications.

---

## 1. Development Goals

The primary objective was to build a complete, functional, production-minded secure document management and access control platform featuring:
- A React (Vite + Tailwind CSS + Lucide Icons) frontend adhering to the strict `#080B0A` (black) and `#10B981` (emerald green) cybersecurity SaaS visual design system.
- A Python Flask backend featuring centralized authorization, real file upload/download, cryptographic SHA-256 integrity, scrypt password hashing, and append-only audit logging.
- Role-based access control with Admin, Owner, and Viewer roles, plus per-document access grants (OWNER, EDIT, VIEW).
- Automated security testing covering 18 distinct threats (IDOR, privilege escalation, revocation immediacy, path traversal, file validation, rate limiting, and user enumeration).

---

## 2. Prompts Used During Implementation

### Primary Master Prompt
- *Prompt:* Comprehensive specification defining technology stack (Flask, React, Vite, Tailwind CSS, SQLAlchemy, Pytest), design palette (`#080B0A`, `#10B981`, `#34D399`, `#121916`, `#18211C`), three user roles, document permissions model, 18 threat scenarios, and human-readable natural coding requirements.

### Phase 1 & 2 Execution Prompts
- *Prompt:* "Scaffold the project with clean directory structure, configure virtualenv with Flask, Flask-SQLAlchemy, Flask-Migrate, Flask-Limiter, PyJWT, and Pytest. Configure Vite React frontend with Tailwind CSS v3."
- *Prompt:* "Implement database models (`User`, `Document`, `DocumentPermission`, `AuditLog`, `RevokedToken`), centralized authorization service denying by default, private storage service with magic-bytes verification, and JWT session handling."

### Phase 3 & 4 Testing & Hardening Prompts
- *Prompt:* "Construct automated pytest suite exercising all 18 threat scenarios against real database and storage fixtures."
- *Prompt:* "Build complete React user interface with responsive collapsible sidebar, role-specific dashboards, upload modal with drag-and-drop, sharing modal with user autocomplete, document details modal with SHA-256 copy, and dark emerald design."

---

## 3. Important Architectural Decisions

1. **Authentication Strategy (JWT with Database Revocation):**
   - *Decision:* Rather than relying on stateful cookies that are prone to cross-site request forgery and complex cross-origin quirks during decoupled React-Flask development, we chose standard custom header `Authorization: Bearer <token>` coupled with a database-backed `RevokedToken` table.
   - *Rationale:* Custom headers prevent CSRF inherently because browsers do not transmit custom headers on cross-origin requests without CORS approval. The revocation table and live `user.is_active` query guarantee instantaneous session termination upon logout or administrator deactivation.

2. **Centralized Fail-Closed Authorization (`AuthorizationService`):**
   - *Decision:* All document mutations, details queries, downloads, sharing grants, and revocations must pass through `AuthorizationService.check_document_access()`.
   - *Rationale:* Eliminates scattered permission checks. Denies access by default. Ensures that even if an attacker guesses an ID or sends direct API calls, the server denies the request and logs `ACCESS_DENIED` to the audit log.

3. **Storage Security Model:**
   - *Decision:* Uploaded files are stored strictly outside the web document root and renamed to randomized UUIDv4 strings. Original filenames are sanitized and stored as database metadata.
   - *Rationale:* Completely prevents path traversal attacks (`../../`) and eliminates execution of uploaded scripts (e.g., preventing a `.php` or `.py` file from being executed by the web server).

4. **Cryptographic Integrity:**
   - *Decision:* Every uploaded file has its SHA-256 checksum calculated during stream ingestion and stored in the database.
   - *Rationale:* Enables verifiable file integrity, non-repudiation, and tamper detection.

---

## 4. Bugs, Inconsistencies & Corrections Made

During the test-driven development phase, three significant technical issues were uncovered and surgically resolved:

### Correction 1: SQLite Path Formatting on Windows
- **Issue:** SQLite URI on Windows generated `sqlite:///C:\...\trustvault.db`, causing SQLite to raise `unable to open database file` due to backslashes.
- **Correction:** Formatted the path using `.as_posix()` (`sqlite:///C:/...`) and ensured the parent directory was explicitly created before engine connection.

### Correction 2: PyJWT 2.x Subject (`sub`) Claim Type
- **Issue:** When running initial token authorization tests, requests failed with `InvalidTokenError: Subject must be a string`.
- **Cause:** PyJWT specification requires the `"sub"` claim to be a string, but `user.id` was passed as an integer (`int`).
- **Correction:** Updated `generate_token()` to cast `user.id` to string (`"sub": str(user.id)`) and updated `require_auth` to safely parse `int(payload.get("sub"))`.

### Correction 3: SQLAlchemy 2.0 Legacy `Query.get()` Modernization
- **Issue:** Pytest emitted `LegacyAPIWarning: The Query.get() method is considered legacy as of the 1.x series of SQLAlchemy and becomes a legacy construct in 2.0.`
- **Correction:** Replaced `Model.query.get(id)` with `db.session.get(Model, id)` across all blueprints, services, and tests, achieving a completely clean test run with 0 warnings.

---

## 5. Automated Security Test Results

The test suite in `backend/tests/test_threats.py` was executed using Pytest:

```
collected 14 items

backend/tests/test_threats.py::test_threat_18_unauthenticated_requests_rejected PASSED [  7%]
backend/tests/test_threats.py::test_threat_13_no_public_admin_registration PASSED [ 14%]
backend/tests/test_threats.py::test_threat_01_and_02_owner_isolation_and_idor PASSED [ 21%]
backend/tests/test_threats.py::test_threat_03_viewer_cannot_mutate_or_delete PASSED [ 28%]
backend/tests/test_threats.py::test_threat_04_and_05_viewer_cannot_admin_or_share PASSED [ 35%]
backend/tests/test_threats.py::test_threat_06_and_07_revocation_blocks_download_immediately PASSED [ 42%]
backend/tests/test_threats.py::test_threat_08_malicious_file_uploads_rejected PASSED [ 50%]
backend/tests/test_threats.py::test_threat_09_path_traversal_defense PASSED [ 57%]
backend/tests/test_threats.py::test_threat_11_user_enumeration_prevention PASSED [ 64%]
backend/tests/test_threats.py::test_threat_12_deactivated_user_blocked_immediately PASSED [ 71%]
backend/tests/test_threats.py::test_threat_14_and_15_audit_logs_and_access_control PASSED [ 78%]
backend/tests/test_threats.py::test_threat_16_safe_file_cleanup_on_deletion PASSED [ 85%]
backend/tests/test_threats.py::test_threat_17_token_revocation_on_logout PASSED [ 92%]
backend/tests/test_threats.py::test_threat_03b_edit_grant_allows_metadata_update_only PASSED [100%]

============================= 14 passed in 7.82s ==============================
```

---

## 6. Implementation Status (Completed vs. Future Enhancements)

### Fully Implemented and Verified
- [x] Flask REST API with blueprints for Auth, Documents, Sharing, Audit, Users, and System.
- [x] React frontend with Tailwind CSS utilizing the exact `#080B0A` and `#10B981` palette.
- [x] Role-based dashboards for Admin, Owner, and Viewer.
- [x] Centralized authorization engine with fail-closed default deny.
- [x] Real drag-and-drop file upload with progress bar, magic-bytes validation, and 15MB limit.
- [x] Real authenticated file download with security headers (`nosniff`, `default-src 'none'`).
- [x] SHA-256 cryptographic checksum calculation and UI verification.
- [x] Immediate permission revocation enforcement.
- [x] Admin user management with account deactivation and immediate session termination.
- [x] Append-only audit logging with role-isolated queries.
- [x] Server-side authorized search preventing document discovery leaks.
- [x] Password rotation with current password verification and live complexity checks.
- [x] 14 automated pytest security tests covering all 18 threat vectors.
- [x] Complete browser testing via `browser_subagent`.

### Documented Scope Limitations & Future Enhancements
- High-concurrency clustering with multiple server instances would benefit from a shared Redis cache for rate limiting instead of memory.
- S3/GCS object-storage adapter interface for multi-region cloud deployment is architected via `StorageService` but defaults to secure local filesystem in development.

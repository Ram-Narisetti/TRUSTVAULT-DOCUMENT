# TrustVault — Secure Document Management & Access Control Platform

TrustVault is a production-minded web application engineered for zero-trust document storage, access control, encrypted sharing, and tamper-resistant audit logging.

Built with a **Python Flask backend** and a **React (Vite) frontend**, it enforces all access control and authorization decisions server-side, preventing Insecure Direct Object References (IDOR), privilege escalation, and unauthorized downloads.

---

## 1. Visual Design & Theme

TrustVault features a cybersecurity SaaS interface using the mandatory black and emerald-green color palette:

- **Primary Background:** `#080B0A`
- **Sidebar Background:** `#0D1210`
- **Card Background:** `#121916`
- **Elevated Surface:** `#18211C`
- **Primary Emerald:** `#10B981`
- **Secondary Emerald:** `#34D399`
- **Text Main / Muted:** `#F3F7F4` / `#9BAAA1`
- **Borders:** `#26362D`
- **Alert Colors:** `#F87171` (Error), `#FBBF24` (Warning)

---

## 2. Key Features

- **Multi-Tier Role-Based Access Control (RBAC):**
  - **Administrator:** Live system telemetry, user management (activate/deactivate), and system-wide audit logging.
  - **Document Owner:** Upload, manage, edit metadata, delete, and delegate access to documents.
  - **Viewer:** Access and download explicitly shared documents with server-enforced `VIEW` or `EDIT` permissions.
- **Fail-Closed Centralized Authorization (`AuthorizationService`):**
  - All document requests pass through a single, testable authorization engine denying access by default.
  - Zero information leakage on search; only authorized records are discoverable.
- **Instant Revocation:**
  - Revoking permission terminates read and download access immediately on the very next HTTP request.
- **Cryptographic Integrity & Private Storage:**
  - Uploaded files are renamed with randomized UUIDs and stored outside the web root.
  - Streaming SHA-256 checksums are calculated upon upload and verified in the UI.
  - Strict allowlist of file formats with magic-byte file signature verification to block executable polyglots (`.exe`, `.sh`, `.py`, `.js`).
- **Append-Only Security Audit Trail:**
  - Immutable audit logs capture logins, uploads, downloads, deletions, sharing grants, revocations, and blocked access attempts.
- **Deactivation Enforcement:**
  - Deactivated accounts are rejected immediately on subsequent API calls, even with unexpired JWTs.

---

## 3. Technology Stack

### Frontend
- **Framework:** React 19 with Vite 8
- **Styling:** Tailwind CSS v3 with customized dark emerald theme
- **Routing:** React Router v7
- **HTTP Client:** Axios with bearer token interceptors
- **Icons:** Lucide React

### Backend
- **Framework:** Python Flask 3.1
- **ORM & DB:** Flask-SQLAlchemy 3.1 (SQLite for development, PostgreSQL-ready)
- **Migrations:** Flask-Migrate 4.1
- **Rate Limiting:** Flask-Limiter 3.8
- **Security:** Scrypt password hashing, PyJWT token management, strict HTTP headers
- **Testing:** Pytest 8.3 with temporary databases and fixtures

---

## 4. Project Directory Structure

```
trustvault/
├── backend/
│   ├── app/
│   │   ├── __init__.py           # Application factory & security headers
│   │   ├── config.py             # Configuration classes (Base, Dev, Test)
│   │   ├── extensions.py         # SQLAlchemy, Limiter, CORS instances
│   │   ├── api/                  # Blueprint REST routes
│   │   │   ├── auth.py           # Register, login, logout, password change
│   │   │   ├── documents.py      # Upload, download, edit, delete, search
│   │   │   ├── sharing.py        # Grant and revoke document permissions
│   │   │   ├── audit.py          # Admin audit logs & owner activity
│   │   │   ├── users.py          # Admin user activation/deactivation
│   │   │   └── system.py         # Dashboard telemetry & categories
│   │   ├── models/               # SQLAlchemy models
│   │   │   ├── user.py           # User account model (scrypt hashing)
│   │   │   ├── document.py       # Document metadata & SHA-256 hash
│   │   │   ├── permission.py     # DocumentPermission ACL grants
│   │   │   ├── audit_log.py      # Immutable audit log ledger
│   │   │   └── revoked_token.py  # Invalidated JWT tracking
│   │   ├── services/             # Business logic layer
│   │   │   ├── auth_service.py
│   │   │   ├── document_service.py
│   │   │   ├── storage_service.py
│   │   │   ├── permission_service.py
│   │   │   ├── audit_service.py
│   │   │   └── user_service.py
│   │   ├── security/             # Centralized security policies
│   │   │   ├── authorization.py  # Centralized document authorization engine
│   │   │   └── token_auth.py     # JWT token encoding, decoding & guards
│   │   └── validators/           # Payload & metadata validators
│   ├── tests/                    # Automated Pytest test suite
│   │   ├── conftest.py           # Test fixtures & 5-actor user matrix
│   │   └── test_threats.py       # 14 tests covering 18 threat scenarios
│   ├── seed.py                   # Development database seeder
│   └── uploads/                  # Private file storage (outside web root)
├── frontend/
│   ├── src/
│   │   ├── api/client.js         # Axios interceptor
│   │   ├── context/              # Auth & Toast state providers
│   │   ├── components/           # Reusable UI & Modal components
│   │   ├── pages/                # Dashboards, Documents, Search, Admin
│   │   ├── App.jsx               # Routes & route guards
│   │   └── index.css             # Tailwind base & vault glow styles
│   ├── index.html
│   ├── tailwind.config.js
│   └── vite.config.js
├── requirements.txt              # Python dependencies
├── .env.example                  # Environment configuration template
├── .gitignore                    # Git ignore definitions
├── run.py                        # Backend application entry point
├── THREATS.md                    # Threat model & mitigation verification
├── SECURITY.md                   # Security architecture & policy
└── PROMPTS.md                    # AI development record & bug fixes
```

---

## 5. Prerequisites

- **Python:** 3.10 or higher
- **Node.js:** 18 or higher (tested on Node v24)
- **Git**

---

## 6. Installation & Local Development Setup

### Step 1: Clone Repository & Create Virtual Environment

```bash
# Windows
python -m venv venv
.\venv\Scripts\activate

# Linux / macOS
python3 -m venv venv
source venv/bin/activate
```

### Step 2: Install Python Dependencies

```bash
pip install -r requirements.txt
```

### Step 3: Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

### Step 4: Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

### Step 5: Initialize Database & Seed Development Data

```bash
python backend/seed.py
```

This creates the SQLite schema and seeds 3 sample accounts with demo documents:
- **Admin:** `admin@trustvault.local` / `AdminVault2026!`
- **Owner:** `owner@trustvault.local` / `OwnerVault2026!`
- **Viewer:** `viewer@trustvault.local` / `ViewerVault2026!`

---

## 7. Secure Administrator Provisioning

TrustVault **never** allows administrator account creation via public registration. To securely create a new administrator account in any environment, run the protected CLI command:

```bash
flask --app run.py create-admin --email newadmin@trustvault.local --username newadmin --full-name "Chief Security Officer"
```

You will be prompted to enter and confirm a secure password matching NIST guidelines.

---

## 8. Starting the Application

### Start Backend API Server
```bash
# In project root with virtualenv active:
python run.py
```
Backend will start on `http://127.0.0.1:5000`.

### Start Frontend Dev Server
```bash
# In frontend directory:
cd frontend
npm run dev
```
Frontend will be available on `http://localhost:5173`. Open your browser and log in with any of the seeded credentials.

---

## 9. Running Security & Unit Tests

Run the complete Pytest test suite:

```bash
pytest -v
```

All 14 automated security tests will execute in a temporary database fixture, validating IDOR defense, owner isolation, viewer restrictions, file traversal protection, malicious upload rejection, and immediate revocation.

---

## 10. Production Deployment Guide

### Backend (WSGI Server)
1. Deploy Flask with **Gunicorn** or **Waitress**:
   ```bash
   pip install gunicorn psycopg2-binary
   gunicorn -w 4 -b 0.0.0.0:5000 "backend.app:create_app()"
   ```
2. Set `DATABASE_URL` to a managed PostgreSQL instance:
   ```
   DATABASE_URL=postgresql://user:password@host:5432/trustvault
   ```
3. Set `FLASK_ENV=production` and `FLASK_DEBUG=0`.
4. Ensure `SECRET_KEY` and `JWT_SECRET_KEY` are at least 32 cryptographically random bytes.

### Frontend
1. Build the production bundle:
   ```bash
   cd frontend
   npm run build
   ```
2. The optimized static bundle in `frontend/dist` can be hosted on **Cloudflare Pages**, **Vercel**, or served through an Nginx reverse proxy pointing `/api` to the Flask WSGI server.

---

## 11. Known Scope Limitations

1. **Local Disk Storage vs. Object Storage:** By default, files are stored on the local filesystem (`backend/uploads/`). For multi-node autoscaling clusters, configure an S3/GCS adapter in `StorageService`.
2. **Rate Limiting Storage:** The default rate limiter uses an in-memory backend. For multi-process WSGI deployments, set `RATELIMIT_STORAGE_URI=redis://localhost:6379/0`.
3. **ClamAV Integration:** Antivirus / malware scanning is architected at the ingestion boundary; in production environments, integrate an active ClamAV daemon socket before saving files to disk.

import io
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app import create_app
from backend.app.extensions import db
from backend.app.models.user import User
from backend.app.models.document import Document
from backend.app.services.document_service import DocumentService
from werkzeug.datastructures import FileStorage


def seed_database():
    app = create_app()
    with app.app_context():
        db.create_all()

        # 1. Admin account
        admin = User.query.filter_by(email="admin@trustvault.local").first()
        if not admin:
            admin = User(
                email="admin@trustvault.local",
                username="admin_security",
                full_name="Chief Security Officer",
                role="admin",
                is_active=True,
            )
            db.session.add(admin)
        admin.set_password("AdminVault2026!")
        admin.is_active = True
        print("[+] Admin account ready: admin@trustvault.local / AdminVault2026!")

        # 2. Owner account
        owner = User.query.filter_by(email="owner@trustvault.local").first()
        if not owner:
            owner = User(
                email="owner@trustvault.local",
                username="john_owner",
                full_name="John Document Owner",
                role="owner",
                is_active=True,
            )
            db.session.add(owner)
        owner.set_password("OwnerVault2026!")
        owner.is_active = True
        print("[+] Owner account ready: owner@trustvault.local / OwnerVault2026!")

        # 3. Viewer account
        viewer = User.query.filter_by(email="viewer@trustvault.local").first()
        if not viewer:
            viewer = User(
                email="viewer@trustvault.local",
                username="alice_viewer",
                full_name="Alice Compliance Auditor",
                role="viewer",
                is_active=True,
            )
            db.session.add(viewer)
        viewer.set_password("ViewerVault2026!")
        viewer.is_active = True
        print("[+] Viewer account ready: viewer@trustvault.local / ViewerVault2026!")

        db.session.commit()

        # 4. Upload initial sample documents for owner if none exist
        if Document.query.count() == 0:
            sample_docs = [
                {
                    "title": "SOC2_Security_Compliance_Audit_2026.pdf",
                    "category": "Legal",
                    "desc": "Annual independent cybersecurity audit assessment and control validation.",
                    "content": b"%PDF-1.4\n% TrustVault SOC2 Security Audit 2026 report verified.",
                },
                {
                    "title": "Enterprise_Risk_Assessment_Q1.pdf",
                    "category": "Finance",
                    "desc": "Quarterly enterprise risk appraisal and mitigation policies.",
                    "content": b"%PDF-1.4\n% TrustVault Q1 Financial Risk Assessment.",
                },
                {
                    "title": "Incident_Response_Playbook.pdf",
                    "category": "Work",
                    "desc": "Standard operating procedures for security incident containment.",
                    "content": b"%PDF-1.4\n% TrustVault Incident Response Playbook v4.",
                },
            ]

            for doc_info in sample_docs:
                fs = FileStorage(
                    stream=io.BytesIO(doc_info["content"]),
                    filename=doc_info["title"],
                    content_type="application/pdf",
                )
                doc, err = DocumentService.upload_document(
                    user=owner,
                    file=fs,
                    title=doc_info["title"],
                    category=doc_info["category"],
                    description=doc_info["desc"],
                )
                if doc:
                    print(f"[+] Seeded document: {doc.title}")

            print("[*] Database seeding completed successfully.")


if __name__ == "__main__":
    seed_database()

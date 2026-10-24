import os
import shutil
import pytest
from pathlib import Path
from backend.app import create_app
from backend.app.config import TestingConfig
from backend.app.extensions import db
from backend.app.models.user import User
from backend.app.models.document import Document
from backend.app.models.permission import DocumentPermission
from backend.app.security.token_auth import generate_token


@pytest.fixture(scope="session")
def app():
    """Create and configure a testing Flask app instance."""
    app = create_app(TestingConfig)
    
    # Ensure test upload folder exists
    upload_path = Path(app.config["UPLOAD_FOLDER"])
    upload_path.mkdir(parents=True, exist_ok=True)
    
    yield app
    
    # Cleanup test upload directory and test db
    if upload_path.exists():
        shutil.rmtree(upload_path, ignore_errors=True)
    test_db_path = Path(TestingConfig.test_db)
    if test_db_path.exists():
        try:
            test_db_path.unlink()
        except Exception:
            pass


@pytest.fixture(scope="function")
def client(app):
    """Flask test client."""
    return app.test_client()


@pytest.fixture(scope="function")
def db_session(app):
    """Provide a fresh database schema for each test."""
    with app.app_context():
        db.create_all()
        yield db
        db.session.remove()
        db.drop_all()


@pytest.fixture
def create_user(app, db_session):
    """Factory fixture to create test users."""
    def _create(email, username, password="SecurePassword123!", role="owner", is_active=True):
        user = User(
            email=email.lower(),
            username=username.lower(),
            full_name=username.capitalize(),
            role=role,
            is_active=is_active,
        )
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        return user
    return _create


@pytest.fixture
def auth_headers(app):
    """Helper fixture to create Authorization Bearer headers."""
    def _headers(user):
        with app.app_context():
            token = generate_token(user)
            return {"Authorization": f"Bearer {token}"}
    return _headers


@pytest.fixture
def test_users(create_user):
    """Create the standard 5-actor security test matrix."""
    admin_a = create_user("admin_a@trustvault.local", "admin_a", role="admin")
    owner_a = create_user("owner_a@trustvault.local", "owner_a", role="owner")
    owner_b = create_user("owner_b@trustvault.local", "owner_b", role="owner")
    viewer_a = create_user("viewer_a@trustvault.local", "viewer_a", role="viewer")
    viewer_b = create_user("viewer_b@trustvault.local", "viewer_b", role="viewer")
    return {
        "admin_a": admin_a,
        "owner_a": owner_a,
        "owner_b": owner_b,
        "viewer_a": viewer_a,
        "viewer_b": viewer_b,
    }

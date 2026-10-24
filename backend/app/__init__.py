import os
from pathlib import Path
import click
from flask import Flask, jsonify
from backend.app.config import Config
from backend.app.extensions import db, migrate, limiter, cors
from backend.app.api import auth_bp, documents_bp, sharing_bp, audit_bp, users_bp, system_bp
from backend.app.models.user import User


def create_app(config_class=Config):
    """TrustVault application factory."""
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(config_class)

    # Ensure storage and instance paths exist
    upload_path = Path(app.config["UPLOAD_FOLDER"])
    upload_path.mkdir(parents=True, exist_ok=True)

    instance_path = Path(app.instance_path)
    instance_path.mkdir(parents=True, exist_ok=True)

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    limiter.init_app(app)
    cors.init_app(
        app,
        origins=app.config.get("CORS_ORIGINS", ["*"]),
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
        supports_credentials=True,
    )

    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(documents_bp)
    app.register_blueprint(sharing_bp)
    app.register_blueprint(audit_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(system_bp)

    # Security headers on every response
    @app.after_request
    def set_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

    # Centralized JSON error handlers
    @app.errorhandler(400)
    def handle_bad_request(e):
        return jsonify({"error": "Bad request. Please verify submitted payload."}), 400

    @app.errorhandler(404)
    def handle_not_found(e):
        return jsonify({"error": "Resource was not found."}), 404

    @app.errorhandler(405)
    def handle_method_not_allowed(e):
        return jsonify({"error": "HTTP method not allowed for this endpoint."}), 405

    @app.errorhandler(413)
    def handle_file_too_large(e):
        return jsonify({"error": "Uploaded file exceeds maximum permitted size (15MB)."}), 413

    @app.errorhandler(429)
    def handle_rate_limit(e):
        return jsonify({"error": "Rate limit exceeded. Please try again shortly."}), 429

    @app.errorhandler(500)
    def handle_internal_error(e):
        return jsonify({"error": "An unexpected internal server error occurred."}), 500

    # Secure CLI admin provisioning
    @app.cli.command("create-admin")
    @click.option("--email", prompt=True, help="Administrator email address")
    @click.option("--username", prompt=True, help="Administrator username")
    @click.option("--full-name", prompt=True, help="Full name")
    @click.option("--password", prompt=True, hide_input=True, confirmation_prompt=True, help="Admin password")
    def create_admin_command(email, username, full_name, password):
        """Secure CLI command to provision the initial administrator."""
        with app.app_context():
            from backend.app.validators.auth_validator import validate_password_strength, validate_email
            
            valid_email, msg = validate_email(email)
            if not valid_email:
                click.echo(f"Error: {msg}")
                return

            valid_pass, msg = validate_password_strength(password)
            if not valid_pass:
                click.echo(f"Error: {msg}")
                return

            existing = User.query.filter((User.email == email) | (User.username == username)).first()
            if existing:
                click.echo("Error: A user with this email or username already exists.")
                return

            admin_user = User(
                email=email.strip().lower(),
                username=username.strip().lower(),
                full_name=full_name.strip(),
                role="admin",
                is_active=True,
            )
            admin_user.set_password(password)

            db.session.add(admin_user)
            db.session.commit()
            click.echo(f"Administrator {email} successfully provisioned.")

    return app

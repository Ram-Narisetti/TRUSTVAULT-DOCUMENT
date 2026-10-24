import os
from backend.app import create_app
from backend.app.extensions import db

app = create_app()

with app.app_context():
    # Ensure database schema is created
    db.create_all()
    try:
        from sqlalchemy import text
        with db.engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN avatar_url TEXT;"))
            conn.commit()
    except Exception:
        pass

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    print(f"[*] Starting TrustVault API on http://127.0.0.1:{port}")
    app.run(host="127.0.0.1", port=port, debug=debug)

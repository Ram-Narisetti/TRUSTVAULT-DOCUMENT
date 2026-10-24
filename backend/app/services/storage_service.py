import os
import uuid
import hashlib
from pathlib import Path
from werkzeug.utils import secure_filename
from flask import current_app
from werkzeug.datastructures import FileStorage


# Known file signatures (magic bytes)
FILE_SIGNATURES = {
    "pdf": [b"%PDF"],
    "png": [b"\x89PNG\r\n\x1a\n"],
    "jpg": [b"\xff\xd8\xff"],
    "jpeg": [b"\xff\xd8\xff"],
    "docx": [b"PK\x03\x04"],
    "xlsx": [b"PK\x03\x04"],
    "pptx": [b"PK\x03\x04"],
}

MIME_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "txt": "text/plain",
    "csv": "text/csv",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
}

DANGEROUS_EXTENSIONS = {
    "exe", "sh", "bat", "cmd", "py", "js", "php", "vbs", "msi", "dll",
    "scr", "jar", "pl", "rb", "ps1", "app", "com", "pif", "hta", "cpl"
}


class StorageService:
    """Handles private file storage, validation, magic-byte checks, and integrity."""

    @classmethod
    def get_upload_folder(cls) -> Path:
        folder = Path(current_app.config["UPLOAD_FOLDER"])
        folder.mkdir(parents=True, exist_ok=True)
        return folder.resolve()

    @classmethod
    def validate_file(cls, file: FileStorage) -> tuple[bool, str]:
        """Validate filename, extension, size, and magic bytes."""
        if not file or not file.filename:
            return False, "No file provided or filename is empty."

        clean_name = secure_filename(file.filename)
        if not clean_name:
            return False, "Invalid filename."

        if "." not in clean_name:
            return False, "File must have a valid extension."

        ext = clean_name.rsplit(".", 1)[1].lower()

        if ext in DANGEROUS_EXTENSIONS:
            return False, f"Executable or script extension (.{ext}) is strictly prohibited."

        allowed = current_app.config.get("ALLOWED_EXTENSIONS", set())
        if ext not in allowed:
            return False, f"File type '.{ext}' is not supported. Allowed: {', '.join(sorted(allowed))}."

        # Read first chunk for magic bytes inspection
        header = file.read(2048)
        file.seek(0)  # Rewind

        # Check signature if known
        if ext in FILE_SIGNATURES:
            signatures = FILE_SIGNATURES[ext]
            matched = any(header.startswith(sig) for sig in signatures)
            if not matched:
                return False, f"File content does not match the expected signature for .{ext}."

        # Text/CSV sanity check: ensure no binary null bytes
        if ext in ("txt", "csv"):
            if b"\x00" in header:
                return False, "Binary file detected with text/csv extension."

        return True, ""

    @classmethod
    def save_file(cls, file: FileStorage) -> dict:
        """
        Securely save uploaded file using a randomized server-side filename.
        Returns metadata dictionary.
        """
        clean_name = secure_filename(file.filename)
        ext = clean_name.rsplit(".", 1)[1].lower()
        storage_filename = f"{uuid.uuid4().hex}.{ext}"

        upload_dir = cls.get_upload_folder()
        destination = (upload_dir / storage_filename).resolve()

        # Path traversal guard
        if not str(destination).startswith(str(upload_dir)):
            raise ValueError("Path traversal attempt detected in storage destination.")

        # Stream and compute SHA-256 hash while saving
        hasher = hashlib.sha256()
        file_size = 0

        with open(destination, "wb") as f:
            while chunk := file.read(65536):
                file_size += len(chunk)
                if file_size > current_app.config["MAX_CONTENT_LENGTH"]:
                    # Clean up partial file
                    f.close()
                    if destination.exists():
                        destination.unlink()
                    raise ValueError(f"File exceeds maximum allowed size ({current_app.config['MAX_CONTENT_LENGTH']} bytes).")
                hasher.update(chunk)
                f.write(chunk)

        mime_type = MIME_TYPES.get(ext, file.content_type or "application/octet-stream")

        return {
            "original_filename": clean_name,
            "storage_filename": storage_filename,
            "file_size": file_size,
            "file_extension": ext,
            "mime_type": mime_type,
            "file_hash": hasher.hexdigest(),
        }

    @classmethod
    def get_file_path(cls, storage_filename: str) -> Path:
        """Resolve and verify storage file path within private storage directory."""
        upload_dir = cls.get_upload_folder()
        # Strip path navigation characters
        safe_name = os.path.basename(storage_filename)
        file_path = (upload_dir / safe_name).resolve()

        if not str(file_path).startswith(str(upload_dir)):
            raise PermissionError("Access outside upload directory is forbidden.")

        if not file_path.is_file():
            raise FileNotFoundError("Requested storage file does not exist.")

        return file_path

    @classmethod
    def delete_file(cls, storage_filename: str) -> bool:
        """Securely unlink file from private filesystem."""
        try:
            path = cls.get_file_path(storage_filename)
            if path.exists():
                path.unlink()
                return True
        except Exception:
            return False
        return False

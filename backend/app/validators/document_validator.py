ALLOWED_CATEGORIES = {
    "Personal", "Academic", "Finance", "Legal", "Work", "Other"
}

ALLOWED_PERMISSIONS = {"VIEW", "EDIT"}


def validate_document_metadata(data: dict) -> tuple[bool, str]:
    if not data or not isinstance(data, dict):
        return False, "Invalid payload."

    title = data.get("title", "").strip()
    if not title or len(title) > 255:
        return False, "Title must be between 1 and 255 characters."

    category = data.get("category", "Other").strip()
    if category not in ALLOWED_CATEGORIES:
        return False, f"Category must be one of: {', '.join(sorted(ALLOWED_CATEGORIES))}."

    description = data.get("description", "")
    if description and len(description) > 2000:
        return False, "Description cannot exceed 2000 characters."

    return True, ""


def validate_share_payload(data: dict) -> tuple[bool, str]:
    if not data or not isinstance(data, dict):
        return False, "Invalid payload."

    recipient_email = data.get("recipient_email", "").strip()
    if not recipient_email:
        return False, "Recipient email is required."

    permission = data.get("permission", "").strip().upper()
    if permission not in ALLOWED_PERMISSIONS:
        return False, f"Permission must be either 'VIEW' or 'EDIT'."

    return True, ""

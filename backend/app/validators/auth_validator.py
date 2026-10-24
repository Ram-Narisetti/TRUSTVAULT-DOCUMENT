import re

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
USERNAME_REGEX = re.compile(r"^[a-zA-Z0-9_]{3,30}$")


def validate_email(email: str) -> tuple[bool, str]:
    if not email or not isinstance(email, str):
        return False, "Email address is required."
    email = email.strip()
    if len(email) > 120 or not EMAIL_REGEX.match(email):
        return False, "Please enter a valid email address."
    return True, ""


def validate_username(username: str) -> tuple[bool, str]:
    if not username or not isinstance(username, str):
        return False, "Username is required."
    username = username.strip()
    if not USERNAME_REGEX.match(username):
        return False, "Username must be 3-30 characters and contain only letters, numbers, and underscores."
    return True, ""


def validate_password_strength(password: str) -> tuple[bool, str]:
    if not password or not isinstance(password, str):
        return False, "Password is required."
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if len(password) > 128:
        return False, "Password cannot exceed 128 characters."
    if not re.search(r"[A-Z]", password):
        return False, "Password must include at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return False, "Password must include at least one lowercase letter."
    if not re.search(r"[0-9]", password):
        return False, "Password must include at least one number."
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return False, "Password must include at least one special character (!@#$%^&* etc.)."
    return True, ""


def validate_registration_payload(data: dict) -> tuple[bool, str]:
    if not data or not isinstance(data, dict):
        return False, "Invalid request payload."

    valid_email, msg = validate_email(data.get("email"))
    if not valid_email:
        return False, msg

    valid_user, msg = validate_username(data.get("username"))
    if not valid_user:
        return False, msg

    full_name = data.get("full_name", "").strip()
    if not full_name or len(full_name) < 2 or len(full_name) > 120:
        return False, "Full name must be between 2 and 120 characters."

    valid_pass, msg = validate_password_strength(data.get("password"))
    if not valid_pass:
        return False, msg

    return True, ""

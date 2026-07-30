"""
Seed script — creates the default super-admin account if one does not exist.

Usage (from the backend/ directory):
    python -m app.db.seed_admin
"""

import sys

from app.db.session import SessionLocal
from app.models.admin_user import AdminUser

DEFAULT_EMAIL = "abc@gmail.com"
DEFAULT_PASSWORD = "Abc@1234"
DEFAULT_FULL_NAME = "Test Admin"


def seed() -> None:
    db = SessionLocal()
    try:
        existing = db.query(AdminUser).filter(AdminUser.email == DEFAULT_EMAIL).first()
        if existing:
            print(f"[seed] Admin account '{DEFAULT_EMAIL}' already exists — skipping.")
            return

        admin = AdminUser(
            email=DEFAULT_EMAIL,
            password=DEFAULT_PASSWORD,
            full_name=DEFAULT_FULL_NAME,
            is_active=True,
            role="super_admin",
        )
        db.add(admin)
        db.commit()
        print(f"[seed] Created super-admin: {DEFAULT_EMAIL}")
        print(f"[seed] Password: {DEFAULT_PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
    sys.exit(0)

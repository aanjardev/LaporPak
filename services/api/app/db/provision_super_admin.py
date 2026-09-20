"""Provision one Super Admin from server-only environment variables."""

import os
from datetime import UTC, datetime
from uuid import UUID, uuid4

import httpx
from sqlalchemy import delete, select, text
from sqlalchemy.dialects.postgresql import insert

from app.core.config import settings
from app.db.session import SessionLocal
from app.db.tables import admin_accounts, admin_unit_memberships


def main() -> None:
    email = os.environ.get("SUPERADMIN_EMAIL", "").strip().lower()
    password = os.environ.get("SUPERADMIN_PASSWORD", "")
    display_name = os.environ.get("SUPERADMIN_DISPLAY_NAME", "Super Admin").strip()
    secret = settings.supabase_secret_key or settings.supabase_service_role_key
    if not email or not password or not secret:
        raise SystemExit(
            "SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, and SUPABASE_SECRET_KEY are required"
        )

    with SessionLocal() as session:
        user_id = session.execute(
            text("select id from auth.users where lower(email) = :email"),
            {"email": email},
        ).scalar_one_or_none()
        if user_id is None:
            response = httpx.post(
                f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users",
                headers={"apikey": secret, "Authorization": f"Bearer {secret}"},
                json={"email": email, "password": password, "email_confirm": True},
                timeout=10,
            )
            response.raise_for_status()
            user_id = UUID(response.json()["id"])

        now = datetime.now(UTC)
        account_id = session.execute(
            select(admin_accounts.c.id).where(
                admin_accounts.c.auth_user_id == user_id
            )
        ).scalar_one_or_none() or uuid4()
        statement = insert(admin_accounts).values(
            id=account_id,
            auth_user_id=user_id,
            role="system_admin",
            display_name=display_name,
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        session.execute(
            statement.on_conflict_do_update(
                index_elements=[admin_accounts.c.auth_user_id],
                set_={
                    "role": "system_admin",
                    "display_name": display_name,
                    "is_active": True,
                    "updated_at": now,
                },
            )
        )
        session.execute(
            delete(admin_unit_memberships).where(
                admin_unit_memberships.c.admin_account_id == account_id
            )
        )
        session.commit()
    print(f"Provisioned Super Admin: {email}")


if __name__ == "__main__":
    main()

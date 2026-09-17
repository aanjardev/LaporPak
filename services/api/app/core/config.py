from uuid import UUID

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    frontend_url: str = "http://localhost:3000"

    database_url: str = ""

    supabase_url: str = ""
    supabase_publishable_key: str = ""
    supabase_secret_key: str = ""

    openclaw_api_key: SecretStr | None = None
    dashboard_api_key: SecretStr | None = None
    dashboard_admin_identifier: str = "admin-desa-demo"
    dashboard_admin_unit_id: UUID | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


settings = Settings()

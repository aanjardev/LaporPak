from uuid import UUID

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    frontend_url: str = "http://localhost:3000"

    database_url: str = ""

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_publishable_key: str = ""
    supabase_secret_key: str = ""
    supabase_service_role_key: str = ""

    whatsapp_access_token: str = ""
    whatsapp_phone_number_id: str = ""
    whatsapp_verify_token: str = ""

    openclaw_api_url: str = ""
    openclaw_api_key: SecretStr | None = None
    openclaw_cli_path: str = "openclaw"
    dashboard_admin_unit_id: UUID | None = None
    knowledge_storage_bucket: str = "knowledge-files"
    knowledge_max_upload_bytes: int = 10 * 1024 * 1024
    report_document_storage_bucket: str = "report-documents"
    village_logo_storage_bucket: str = "village-logos"
    public_verification_url: str = "http://localhost:3000"
    report_rate_limit_per_hour: int = 5
    allow_legacy_admin_fallback: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


settings = Settings()

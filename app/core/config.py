from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Health Dashboard Backend"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    app_debug: bool = True

    database_url: str = "sqlite:///./health_dashboard.db"

    allowed_origins: str = "http://localhost:3000,http://localhost:5173,https://lovable.dev"
    lovable_webhook_url: str | None = None
    lovable_api_key: str | None = None

    aws_region: str = "eu-central-1"
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None
    aws_session_token: str | None = None

    enable_bedrock: bool = False
    bedrock_model_id: str = Field(default="anthropic.claude-3-5-sonnet-20241022-v2:0")

    report_storage_backend: str = "local"
    reports_dir: str = "./data/reports"
    s3_reports_bucket: str | None = None
    s3_reports_prefix: str = "reports"

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

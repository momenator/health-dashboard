from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "AI4Good Health Chatbot Backend"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    app_debug: bool = True

    # AWS
    aws_region: str = "eu-central-1"
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None
    aws_session_token: str | None = None

    # OpenAI
    enable_openai: bool = False
    openai_api_key: str | None = None
    openai_model: str = "gpt-5.5"
    openai_router_model: str | None = None
    openai_query_model: str | None = None
    openai_answer_model: str | None = None
    openai_chart_model: str | None = None
    openai_recommendation_model: str | None = None
    openai_report_model: str | None = None

    # Groq (optional, public-context ranking only)
    groq_api_key: str | None = None
    groq_model: str = "llama-3.1-8b-instant"
    enable_groq_context: bool = False

    # Athena
    athena_database: str = "ai4good_health"
    athena_output_s3: str = "s3://ai4good-athena-results/"
    reporting_s3_prefix: str = "s3://ai4good-health-data/ai4good-health/reporting/2026/"

    # Data
    allowed_tables: str = "ambulance_causes,ambulance_trips,community_workers,mchp_patient_support,sensitization_activities,tb_patient_journey,reporting_catalog"
    max_query_rows: int = 1000
    data_dir: str = "data/reporting"
    upload_raw_dir: str = "/tmp/health-dashboard/uploads/raw"
    upload_quarantine_dir: str = "/tmp/health-dashboard/uploads/quarantine"
    pii_sanitizer_script: str | None = None

    # CORS
    allowed_origins: str = (
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,https://lovable.dev"
    )
    allowed_origin_regex: str | None = (
        r"^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$"
    )

    # Lovable
    lovable_webhook_url: str | None = None
    lovable_api_key: str | None = None

    # Legacy DB (kept for backward compat)
    database_url: str = "sqlite:///./health_dashboard.db"

    @property
    def cors_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.allowed_origins.split(",")
            if origin.strip()
        ]

    @property
    def allowed_tables_list(self) -> list[str]:
        configured = [t.strip() for t in self.allowed_tables.split(",") if t.strip()]
        discovered: list[str] = []
        data_path = Path(self.data_dir)
        if data_path.exists():
            blocked_prefixes = ("private", "raw", "cleaned", "quality")
            discovered = [
                path.stem
                for path in data_path.glob("*.csv")
                if not path.stem.lower().startswith(blocked_prefixes)
            ]
        return list(dict.fromkeys([*configured, *discovered]))

    @property
    def llm_enabled(self) -> bool:
        return self.enable_openai

    @property
    def model_provider(self) -> str:
        if self.enable_openai:
            return "openai"
        return "disabled"

    def get_openai_model_id(self, role: str) -> str:
        """Get the OpenAI model ID for a specific role."""
        role_map = {
            "router": self.openai_router_model,
            "query": self.openai_query_model,
            "answer": self.openai_answer_model,
            "chart": self.openai_chart_model,
            "recommendation": self.openai_recommendation_model,
            "report": self.openai_report_model,
        }
        return role_map.get(role) or self.openai_model


@lru_cache
def get_settings() -> Settings:
    return Settings()

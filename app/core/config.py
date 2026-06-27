from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

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
    openai_api_key: str | None = None
    openai_model_id: str = "gpt-4o-mini"

    # Bedrock
    enable_bedrock: bool = False
    bedrock_model_id: str = Field(default="anthropic.claude-3-5-sonnet-20241022-v2:0")
    bedrock_router_model_id: str | None = None
    bedrock_query_model_id: str | None = None
    bedrock_answer_model_id: str | None = None
    bedrock_chart_model_id: str | None = None
    bedrock_recommendation_model_id: str | None = None
    bedrock_report_model_id: str | None = None

    # Athena
    athena_database: str = "ai4good_health"
    athena_output_s3: str = "s3://ai4good-athena-results/"
    reporting_s3_prefix: str = "s3://ai4good-health-data/ai4good-health/reporting/2026/"

    # Data
    allowed_tables: str = "ambulance_causes,ambulance_trips,community_workers,mchp_patient_support,sensitization_activities,tb_patient_journey,reporting_catalog"
    max_query_rows: int = 1000
    data_dir: str = "data/reporting"

    # CORS
    allowed_origins: str = "http://localhost:3000,http://localhost:5173,https://lovable.dev"

    # Lovable
    lovable_webhook_url: str | None = None
    lovable_api_key: str | None = None

    # API Key for incoming requests
    api_key: str | None = None

    # Legacy DB (kept for backward compat)
    database_url: str = "sqlite:///./health_dashboard.db"

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    @property
    def allowed_tables_list(self) -> list[str]:
        return [t.strip() for t in self.allowed_tables.split(",") if t.strip()]

    def get_model_id(self, role: str) -> str:
        """Get the model ID for a specific role, falling back to the default."""
        role_map = {
            "router": self.bedrock_router_model_id,
            "query": self.bedrock_query_model_id,
            "answer": self.bedrock_answer_model_id,
            "chart": self.bedrock_chart_model_id,
            "recommendation": self.bedrock_recommendation_model_id,
            "report": self.bedrock_report_model_id,
        }
        return role_map.get(role) or self.bedrock_model_id


@lru_cache
def get_settings() -> Settings:
    return Settings()

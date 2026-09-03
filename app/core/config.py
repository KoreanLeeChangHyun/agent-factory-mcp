"""Environment-backed application settings."""

from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Agent Factory MCP process settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="AGENT_FACTORY_",
        extra="ignore",
    )

    app_name: str = "Agent Factory MCP"
    environment: Literal["local", "test", "staging", "production"] = "local"
    debug: bool = False
    log_level: str = "INFO"
    database_url: str = (
        "postgresql+asyncpg://agent_factory:agent_factory@localhost:5432/agent_factory"
    )
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"
    s3_endpoint_url: str = "http://localhost:9000"
    s3_access_key: str = "agent_factory"
    s3_secret_key: str = "local-development-only"
    s3_bucket: str = "agent-factory"
    project_root: Path | None = None


settings = Settings()

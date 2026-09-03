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
    project_root: Path | None = None


settings = Settings()

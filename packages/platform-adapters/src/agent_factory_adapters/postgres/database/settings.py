"""PostgreSQL connection configuration; no application or UI settings."""

import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class DatabaseSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AGENT_FACTORY_", extra="ignore")
    database_url: str = (
        "postgresql+asyncpg://agent_factory:agent_factory@localhost:5432/agent_factory"
    )
    worker_database_url: str | None = None
    database_pool_size: int = 10
    database_max_overflow: int = 20
    database_pool_recycle_seconds: int = 1800


settings = DatabaseSettings(_env_file=os.environ.get("AGENT_FACTORY_ENV_FILE") or None)

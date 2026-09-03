"""Environment-backed application settings."""

from pathlib import Path
from typing import Literal

from pydantic import SecretStr, model_validator
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
    database_pool_size: int = 10
    database_max_overflow: int = 20
    database_pool_recycle_seconds: int = 1800
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"
    s3_endpoint_url: str = "http://localhost:9000"
    s3_access_key: str = "agent_factory"
    s3_secret_key: str = "local-development-only"
    s3_bucket: str = "agent-factory"
    auth_token_secret: SecretStr = SecretStr("local-development-secret-change-me")
    auth_session_ttl_hours: int = 24 * 7
    auth_max_failed_attempts: int = 5
    auth_lock_minutes: int = 15
    session_cookie_name: str = "agent_factory_session"
    session_cookie_secure: bool = False
    google_client_id: str | None = None
    google_client_secret: SecretStr | None = None
    github_client_id: str | None = None
    github_client_secret: SecretStr | None = None
    public_base_url: str = "http://127.0.0.1:8000"
    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_from_address: str = "no-reply@agent-factory.local"
    smtp_use_tls: bool = False
    project_root: Path | None = None

    @model_validator(mode="after")
    def validate_security_configuration(self) -> "Settings":
        """Reject partial providers and unsafe production cookie secrets."""

        provider_pairs = (
            ("google", self.google_client_id, self.google_client_secret),
            ("github", self.github_client_id, self.github_client_secret),
        )
        for name, client_id, client_secret in provider_pairs:
            if bool(client_id) is not bool(client_secret):
                raise ValueError(f"{name} OAuth client ID and secret must be configured together")
        if self.environment in {"staging", "production"}:
            secret = self.auth_token_secret.get_secret_value()
            if secret == "local-development-secret-change-me" or len(secret) < 32:
                raise ValueError(
                    "a unique authentication secret of at least 32 characters is required"
                )
            if not self.session_cookie_secure:
                raise ValueError(
                    "secure session cookies are required outside local and test environments"
                )
            if not self.public_base_url.startswith("https://"):
                raise ValueError(
                    "the public base URL must use HTTPS outside local and test environments"
                )
        return self


settings = Settings()

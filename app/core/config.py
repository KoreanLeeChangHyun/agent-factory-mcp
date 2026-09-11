"""Environment-backed application settings."""

import os
from typing import Literal

from pydantic import Field, SecretStr, field_validator, model_validator
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
    root_path: str = ""
    cors_allowed_origins: list[str] = []
    trusted_hosts: list[str] = ["localhost", "127.0.0.1", "testserver"]
    rate_limit_enabled: bool = True
    rate_limit_requests: int = 30
    rate_limit_window_seconds: int = 60
    database_url: str = (
        "postgresql+asyncpg://agent_factory:agent_factory@localhost:5432/agent_factory"
    )
    database_pool_size: int = 10
    database_max_overflow: int = 20
    database_pool_recycle_seconds: int = 1800
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"
    job_max_attempts: int = 5
    job_retry_base_seconds: int = 30
    job_retry_max_seconds: int = 3600
    worker_soft_time_limit_seconds: int = 900
    worker_time_limit_seconds: int = 960
    s3_endpoint_url: str = "http://localhost:9000"
    s3_access_key: str = "agent_factory"
    s3_secret_key: str = "local-development-only"
    s3_bucket: str = "agent-factory"
    s3_region: str = "us-east-1"
    document_max_upload_bytes: int = 25 * 1024 * 1024
    embedding_provider: str = "disabled"
    embedding_base_url: str = "https://api.openai.com/v1"
    embedding_api_key: SecretStr | None = None
    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 1536
    document_chunk_characters: int = 2400
    document_chunk_overlap: int = 240
    integration_encryption_key: SecretStr = SecretStr("local-integration-key-change-me")
    integration_encryption_key_version: int = 1
    google_drive_oauth_client_id: str | None = Field(
        default=None, validation_alias="AF_GOOGLE_DRIVE_OAUTH_CLIENT_ID"
    )
    google_drive_oauth_client_secret: SecretStr | None = Field(
        default=None, validation_alias="AF_GOOGLE_DRIVE_OAUTH_CLIENT_SECRET"
    )
    google_drive_oauth_redirect_uri: str | None = Field(
        default=None, validation_alias="AF_GOOGLE_DRIVE_OAUTH_REDIRECT_URI"
    )
    gmail_oauth_client_id: str | None = Field(
        default=None, validation_alias="AF_GMAIL_OAUTH_CLIENT_ID"
    )
    gmail_oauth_client_secret: SecretStr | None = Field(
        default=None, validation_alias="AF_GMAIL_OAUTH_CLIENT_SECRET"
    )
    gmail_oauth_redirect_uri: str | None = Field(
        default=None, validation_alias="AF_GMAIL_OAUTH_REDIRECT_URI"
    )
    onedrive_oauth_client_id: str | None = Field(
        default=None, validation_alias="AF_ONEDRIVE_OAUTH_CLIENT_ID"
    )
    onedrive_oauth_client_secret: SecretStr | None = Field(
        default=None, validation_alias="AF_ONEDRIVE_OAUTH_CLIENT_SECRET"
    )
    onedrive_oauth_redirect_uri: str | None = Field(
        default=None, validation_alias="AF_ONEDRIVE_OAUTH_REDIRECT_URI"
    )
    slack_oauth_client_id: str | None = Field(
        default=None, validation_alias="AF_SLACK_OAUTH_CLIENT_ID"
    )
    slack_oauth_client_secret: SecretStr | None = Field(
        default=None, validation_alias="AF_SLACK_OAUTH_CLIENT_SECRET"
    )
    slack_oauth_redirect_uri: str | None = Field(
        default=None, validation_alias="AF_SLACK_OAUTH_REDIRECT_URI"
    )
    notion_oauth_client_id: str | None = Field(
        default=None, validation_alias="AF_NOTION_OAUTH_CLIENT_ID"
    )
    notion_oauth_client_secret: SecretStr | None = Field(
        default=None, validation_alias="AF_NOTION_OAUTH_CLIENT_SECRET"
    )
    notion_oauth_redirect_uri: str | None = Field(
        default=None, validation_alias="AF_NOTION_OAUTH_REDIRECT_URI"
    )
    onedrive_oauth_tenant: str = Field(
        default="common", validation_alias="AF_ONEDRIVE_OAUTH_TENANT"
    )
    webhook_max_payload_bytes: int = 1024 * 1024
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

    @field_validator("root_path")
    @classmethod
    def validate_root_path(cls, value: str) -> str:
        """Accept an empty root or one normalized absolute URL path."""

        if value == "":
            return value
        if not value.startswith("/") or value.endswith("/") or "//" in value:
            raise ValueError("root path must be empty or a normalized absolute path")
        return value

    @model_validator(mode="after")
    def validate_security_configuration(self) -> "Settings":
        """Reject partial providers and unsafe production cookie secrets."""

        if self.embedding_dimensions != 1536:
            raise ValueError("this deployment currently requires 1536 embedding dimensions")
        provider_pairs = (
            ("google", self.google_client_id, self.google_client_secret),
            ("github", self.github_client_id, self.github_client_secret),
        )
        for name, client_id, client_secret in provider_pairs:
            if bool(client_id) is not bool(client_secret):
                raise ValueError(f"{name} OAuth client ID and secret must be configured together")
        if self.environment in {"staging", "production"}:
            secret = self.auth_token_secret.get_secret_value()
            if secret == "local-development-secret-change-me" or len(secret) < 32:  # nosec B105
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
            integration_key = self.integration_encryption_key.get_secret_value()
            if integration_key == "local-integration-key-change-me" or len(integration_key) < 32:
                raise ValueError(
                    "a unique integration encryption key of at least 32 characters is required"
                )
            if "*" in self.cors_allowed_origins or "*" in self.trusted_hosts:
                raise ValueError("wildcard CORS origins and trusted hosts are forbidden")
        return self


settings = Settings(  # type: ignore[call-arg]  # pydantic-settings runtime init option
    _env_file=os.environ.get("AGENT_FACTORY_ENV_FILE", ".env") or None
)

"""Compatibility bridge for provider-specific OAuth adapters."""

from dataclasses import dataclass

from agent_factory_adapters.identity.oauth import external_profile
from agent_factory_adapters.identity.oauth import build_oauth as _build_oauth
from agent_factory_core.identity import ExternalProfile


@dataclass(frozen=True, slots=True)
class _Settings:
    google_client_id: str | None
    google_client_secret: str | None
    github_client_id: str | None
    github_client_secret: str | None


def build_oauth(settings: object):
    def value(name: str) -> str | None:
        candidate = getattr(settings, name)
        return candidate.get_secret_value() if hasattr(candidate, "get_secret_value") else candidate

    return _build_oauth(
        _Settings(
            value("google_client_id"),
            value("google_client_secret"),
            value("github_client_id"),
            value("github_client_secret"),
        )
    )


__all__ = ["ExternalProfile", "build_oauth", "external_profile"]

"""Provider-specific OAuth verification; core receives only a verified profile."""

from typing import Any, Protocol

from agent_factory_core.identity import ExternalProfile
from agent_factory_core.shared.errors import AuthenticationError
from authlib.integrations.starlette_client import OAuth


class OAuthSettings(Protocol):
    google_client_id: str | None
    google_client_secret: str | None
    github_client_id: str | None
    github_client_secret: str | None


def build_oauth(settings: OAuthSettings) -> OAuth:
    oauth = OAuth()
    if settings.google_client_id and settings.google_client_secret:
        oauth.register(
            name="google",
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
            server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
            client_kwargs={"scope": "openid email profile"},
        )
    if settings.github_client_id and settings.github_client_secret:
        oauth.register(
            name="github",
            client_id=settings.github_client_id,
            client_secret=settings.github_client_secret,
            access_token_url="https://github.com/login/oauth/access_token",  # nosec B106
            authorize_url="https://github.com/login/oauth/authorize",
            api_base_url="https://api.github.com/",
            client_kwargs={"scope": "read:user user:email", "code_challenge_method": "S256"},
        )
    return oauth


async def external_profile(provider: str, client: Any, token: dict[str, Any]) -> ExternalProfile:
    if provider == "google":
        userinfo = token.get("userinfo")
        if not userinfo or not userinfo.get("email_verified"):
            raise AuthenticationError("unverified_provider_email")
        return ExternalProfile(
            "google",
            str(userinfo["sub"]),
            str(userinfo["email"]),
            str(userinfo.get("name") or userinfo["email"]),
        )
    if provider == "github":
        profile = (await client.get("user", token=token)).json()
        emails = (await client.get("user/emails", token=token)).json()
        email = next(
            (item["email"] for item in emails if item.get("primary") and item.get("verified")), None
        )
        if not email:
            raise AuthenticationError("unverified_provider_email")
        return ExternalProfile(
            "github",
            str(profile["id"]),
            str(email),
            str(profile.get("name") or profile.get("login") or email),
        )
    raise AuthenticationError("unsupported_oauth_provider")

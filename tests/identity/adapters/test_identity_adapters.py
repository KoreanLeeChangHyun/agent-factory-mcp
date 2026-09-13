"""Identity crypto and verified-provider adapter contracts."""

import pytest
from agent_factory_adapters.identity import SystemIdentityCrypto, external_profile
from agent_factory_core.shared.errors import AuthenticationError


def test_argon2_hash_upgrade_contract_and_keyed_digest() -> None:
    crypto = SystemIdentityCrypto("first-secret")
    encoded = crypto.hash_password("correct horse battery staple")
    assert encoded != "correct horse battery staple"
    assert crypto.verify_password("correct horse battery staple", encoded)[0]
    assert not crypto.verify_password("incorrect", encoded)[0]
    assert crypto.token_digest("token") != SystemIdentityCrypto("second-secret").token_digest(
        "token"
    )


@pytest.mark.asyncio
async def test_google_requires_provider_verified_email() -> None:
    with pytest.raises(AuthenticationError, match="unverified_provider_email"):
        await external_profile("google", object(), {"userinfo": {"email_verified": False}})
    profile = await external_profile(
        "google",
        object(),
        {
            "userinfo": {
                "sub": "subject",
                "email": "owner@example.test",
                "email_verified": True,
            }
        },
    )
    assert profile.subject == "subject"


@pytest.mark.asyncio
async def test_github_selects_primary_verified_email() -> None:
    class Response:
        def __init__(self, value: object) -> None:
            self.value = value

        def json(self) -> object:
            return self.value

    class Client:
        async def get(self, path: str, token: object) -> Response:
            return Response(
                {"id": 7, "login": "owner"}
                if path == "user"
                else [{"email": "owner@example.test", "primary": True, "verified": True}]
            )

    profile = await external_profile("github", Client(), {})
    assert profile.email == "owner@example.test"

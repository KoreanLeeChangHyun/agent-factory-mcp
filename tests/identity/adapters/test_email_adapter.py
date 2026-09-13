from uuid import uuid4

import pytest
from agent_factory_adapters.email import SMTPConfiguration, SMTPEmailSender
from agent_factory_adapters.organizations import SystemInvitationTokens


def test_invitation_tokens_are_random_and_hmac_digested() -> None:
    tokens = SystemInvitationTokens("test-only-secret")
    first, second = tokens.new_token(), tokens.new_token()
    assert first != second
    assert tokens.digest(first) != first.encode()
    assert len(tokens.digest(first)) == 32


@pytest.mark.asyncio
async def test_invitation_uses_fragment_and_never_query_for_token(monkeypatch) -> None:
    captured = {}

    async def capture(self, recipient, subject, body):
        captured.update(recipient=recipient, subject=subject, body=body)

    monkeypatch.setattr(SMTPEmailSender, "_send", capture)
    sender = SMTPEmailSender(
        SMTPConfiguration(
            "https://factory.example", "smtp.invalid", 465, True, "noreply@example.com"
        )
    )
    await sender.send_organization_invitation("person@example.com", uuid4(), "opaque-secret")
    assert "#invitation=opaque-secret" in captured["body"]
    assert "?invitation=opaque-secret" not in captured["body"]
    assert captured["recipient"] == "person@example.com"

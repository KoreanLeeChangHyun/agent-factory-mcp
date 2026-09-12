"""Immutable SMTP adapter for authentication and invitation delivery."""

from dataclasses import dataclass
from email.message import EmailMessage
from uuid import UUID

from aiosmtplib import SMTP


@dataclass(frozen=True, slots=True)
class SMTPConfiguration:
    public_base_url: str
    host: str
    port: int
    use_tls: bool
    from_address: str


class SMTPEmailSender:
    def __init__(self, configuration: SMTPConfiguration) -> None:
        self.configuration = configuration

    async def send_verification(self, recipient: str, token: str) -> None:
        await self._send(
            recipient,
            "Verify your Agent Factory email",
            f"{self.configuration.public_base_url}/verify-email?token={token}",
        )

    async def send_password_reset(self, recipient: str, token: str) -> None:
        await self._send(
            recipient,
            "Reset your Agent Factory password",
            f"{self.configuration.public_base_url}/reset-password?token={token}",
        )

    async def send_organization_invitation(
        self, recipient: str, organization_id: UUID, token: str
    ) -> None:
        await self._send(
            recipient,
            "Agent Factory 조직 초대",
            f"{self.configuration.public_base_url}/join/?organization_invite={organization_id}"
            f"#invitation={token}",
        )

    async def _send(self, recipient: str, subject: str, body: str) -> None:
        message = EmailMessage()
        message["From"] = self.configuration.from_address
        message["To"] = recipient
        message["Subject"] = subject
        message.set_content(body)
        client = SMTP(
            hostname=self.configuration.host,
            port=self.configuration.port,
            use_tls=self.configuration.use_tls,
        )
        async with client:
            await client.send_message(message)

"""SMTP delivery adapter for transactional authentication messages."""

from email.message import EmailMessage

from aiosmtplib import SMTP

from app.core.config import Settings


class EmailSender:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def send_verification(self, recipient: str, token: str) -> None:
        await self._send(
            recipient,
            "Verify your Agent Factory email",
            f"{self.settings.public_base_url}/verify-email?token={token}",
        )

    async def send_password_reset(self, recipient: str, token: str) -> None:
        await self._send(
            recipient,
            "Reset your Agent Factory password",
            f"{self.settings.public_base_url}/reset-password?token={token}",
        )

    async def _send(self, recipient: str, subject: str, body: str) -> None:
        message = EmailMessage()
        message["From"] = self.settings.smtp_from_address
        message["To"] = recipient
        message["Subject"] = subject
        message.set_content(body)
        client = SMTP(
            hostname=self.settings.smtp_host,
            port=self.settings.smtp_port,
            use_tls=self.settings.smtp_use_tls,
        )
        async with client:
            await client.send_message(message)

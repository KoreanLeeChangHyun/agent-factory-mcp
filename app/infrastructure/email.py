"""Compatibility settings bridge to the target SMTP adapter."""

from app.core.config import Settings
from agent_factory_adapters.email import SMTPConfiguration, SMTPEmailSender


class EmailSender(SMTPEmailSender):
    def __init__(self, settings: Settings) -> None:
        super().__init__(
            SMTPConfiguration(
                public_base_url=str(settings.public_base_url).rstrip("/"),
                host=settings.smtp_host,
                port=settings.smtp_port,
                use_tls=settings.smtp_use_tls,
                from_address=settings.smtp_from_address,
            )
        )

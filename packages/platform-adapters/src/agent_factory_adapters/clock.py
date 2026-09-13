"""System time adapter shared by domain-specific clock ports."""

from datetime import UTC, datetime


class SystemClock:
    def now(self) -> datetime:
        return datetime.now(UTC)

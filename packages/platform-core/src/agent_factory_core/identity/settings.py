from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class IdentitySettings:
    session_ttl_hours: int
    max_failed_attempts: int
    lock_minutes: int

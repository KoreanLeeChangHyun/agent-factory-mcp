"""Thin HTTP cookie adapter for core session credentials."""

from dataclasses import dataclass

from starlette.responses import Response


@dataclass(frozen=True, slots=True)
class SessionCookieSettings:
    name: str
    path: str
    secure: bool
    max_age: int


def set_session_cookies(
    response: Response,
    settings: SessionCookieSettings,
    session_token: str,
    csrf_token: str,
) -> None:
    response.set_cookie(
        settings.name,
        session_token,
        max_age=settings.max_age,
        httponly=True,
        secure=settings.secure,
        samesite="lax",
        path=settings.path,
    )
    response.set_cookie(
        "agent_factory_csrf",
        csrf_token,
        max_age=settings.max_age,
        httponly=False,
        secure=settings.secure,
        samesite="strict",
        path=settings.path,
    )


def clear_session_cookies(response: Response, settings: SessionCookieSettings) -> None:
    response.delete_cookie(settings.name, path=settings.path)
    response.delete_cookie("agent_factory_csrf", path=settings.path)

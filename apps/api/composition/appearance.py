from agent_factory_adapters import PostgresThemeProfileRepository, SemanticThemeValidator
from agent_factory_core import GetThemeProfile, SaveThemeProfile
from sqlalchemy.ext.asyncio import AsyncSession

from api.http.routes.appearance import ThemeService


def build_theme_service(session: AsyncSession, *, request_id: str | None = None) -> ThemeService:
    repository = PostgresThemeProfileRepository(session, request_id=request_id)
    return ThemeService(
        get=GetThemeProfile(repository),
        save=SaveThemeProfile(repository, SemanticThemeValidator()),
    )

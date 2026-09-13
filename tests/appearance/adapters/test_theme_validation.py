from uuid import UUID

import pytest
from agent_factory_adapters import SemanticThemeValidator
from agent_factory_core import ThemeBase, ThemeDensity, ThemeUpdate, ThemeValidationError


def update(**overrides: str) -> ThemeUpdate:
    return ThemeUpdate(
        base=ThemeBase.DARK,
        density=ThemeDensity.COMPACT,
        overrides=overrides,
        reduced_motion=False,
        expected_revision=0,
    )


def test_validates_final_palette_and_rejects_unknown_tokens() -> None:
    SemanticThemeValidator().validate(update(accent="#63A8FF"))
    with pytest.raises(ThemeValidationError, match="unknown theme tokens"):
        SemanticThemeValidator().validate(update(background="#FFFFFF"))
    with pytest.raises(ThemeValidationError, match="application surface"):
        SemanticThemeValidator().validate(update(surface="#181D25", text="#202631"))


def test_default_profile_is_unsaved_revision_zero() -> None:
    from agent_factory_core import ThemeProfile

    profile = ThemeProfile.default(UUID("00000000-0000-4000-8000-000000000001"))
    assert profile.revision == 0
    assert profile.base is ThemeBase.DARK

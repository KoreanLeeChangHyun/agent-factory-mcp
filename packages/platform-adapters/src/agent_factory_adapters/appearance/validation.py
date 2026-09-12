from __future__ import annotations

import re

from agent_factory_core import ThemeBase, ThemeUpdate, ThemeValidationError

HEX_COLOR = re.compile(r"^#[0-9A-Fa-f]{6}$")
ALLOWED_OVERRIDES = frozenset({"accent", "focus", "surface", "text"})
BASE_COLORS = {
    ThemeBase.DARK: {
        "background": "#11151B",
        "surface": "#181D25",
        "raised": "#202631",
        "hover": "#29313D",
        "text": "#E8ECF2",
        "accent": "#63A8FF",
        "accentText": "#081525",
        "focus": "#8FC1FF",
    },
    ThemeBase.LIGHT: {
        "background": "#EEF1F5",
        "surface": "#FFFFFF",
        "raised": "#F5F7FA",
        "hover": "#E7EDF5",
        "text": "#17202B",
        "accent": "#075FAB",
        "accentText": "#FFFFFF",
        "focus": "#004F91",
    },
    ThemeBase.HIGH_CONTRAST: {
        "background": "#000000",
        "surface": "#000000",
        "raised": "#111111",
        "hover": "#202020",
        "text": "#FFFFFF",
        "accent": "#FFFF00",
        "accentText": "#000000",
        "focus": "#00FFFF",
    },
}


def _luminance(color: str) -> float:
    channels = [int(color[index : index + 2], 16) / 255 for index in (1, 3, 5)]
    linear = [
        value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4
        for value in channels
    ]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def contrast_ratio(first: str, second: str) -> float:
    lighter, darker = sorted((_luminance(first), _luminance(second)), reverse=True)
    return (lighter + 0.05) / (darker + 0.05)


class SemanticThemeValidator:
    """Validate the final semantic palette rather than isolated override values."""

    def validate(self, update: ThemeUpdate) -> None:
        findings: list[str] = []
        unknown = set(update.overrides) - ALLOWED_OVERRIDES
        if unknown:
            findings.append(f"unknown theme tokens: {', '.join(sorted(unknown))}")
        for token, value in update.overrides.items():
            if token in ALLOWED_OVERRIDES and not HEX_COLOR.fullmatch(value):
                findings.append(f"{token} must be a six-digit hexadecimal color")
        if update.expected_revision < 0:
            findings.append("expectedRevision must not be negative")
        if findings:
            raise ThemeValidationError(findings)

        palette = {**BASE_COLORS[update.base], **update.overrides}
        surfaces = (palette["background"], palette["surface"], palette["raised"], palette["hover"])
        if any(contrast_ratio(palette["text"], surface) < 4.5 for surface in surfaces):
            findings.append("text and every application surface must have at least 4.5:1 contrast")
        if any(contrast_ratio(palette["accent"], surface) < 3 for surface in surfaces):
            findings.append("accent and every application surface must have at least 3:1 contrast")
        if contrast_ratio(palette["accent"], palette["accentText"]) < 4.5:
            findings.append("accent and accent text must have at least 4.5:1 contrast")
        if any(contrast_ratio(palette["focus"], surface) < 3 for surface in surfaces):
            findings.append("focus and every application surface must have at least 3:1 contrast")
        if findings:
            raise ThemeValidationError(findings)

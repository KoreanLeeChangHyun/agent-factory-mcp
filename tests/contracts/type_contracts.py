"""Static type fixture for generated closed contract vocabulary."""

from agent_factory_contracts.generated.models import AssetDescriptor, ThemeProfile

ASSET: AssetDescriptor = {
    "id": "resource-table@1",
    "kind": "display",
    "allowedRegions": ["panel"],
    "properties": [
        {
            "name": "mode",
            "type": "string",
            "required": True,
            "maxLength": 80,
            "enum": ["compact", "comfortable"],
        },
        {"name": "rows", "type": "record-list", "required": True, "maxItems": 1000},
        {"name": "tags", "type": "string-list", "required": False, "maxItems": 32},
        {"name": "count", "type": "integer", "required": False},
        {"name": "ratio", "type": "number", "required": False},
        {"name": "enabled", "type": "boolean", "required": False},
    ],
    "inputs": [],
    "outputs": [],
    "slots": [],
    "states": ["loading", "empty", "ready", "stale", "error", "permission-denied", "disabled"],
    "actions": ["select", "refresh", "submit", "navigate-internal", "toggle", "dismiss"],
    "accessibility": {
        "role": "table",
        "keyboard": "Native table semantics.",
        "live": "polite",
    },
    "provenance": {"source": "type fixture", "license": "Project-owned"},
    "example": {"label": "Resources", "compact": True},
}

THEME: ThemeProfile = {
    "schemaVersion": "1.0",
    "userId": "0123456789abcdef0123456789abcdef",
    "revision": 1,
    "base": "high-contrast",
    "density": "comfortable",
    "overrides": {
        "accent": "#4C9AFF",
        "focus": "#79B8FF",
        "surface": "#11151B",
        "text": "#FFFFFF",
    },
    "reducedMotion": True,
}

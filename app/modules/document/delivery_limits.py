"""Deployment-tunable delivery bounds, always clamped to finite hard caps."""
from dataclasses import dataclass
import os

MiB = 1024 * 1024

@dataclass(frozen=True)
class PackageLimits:
    upload_bytes: int = 25 * MiB
    expanded_bytes: int = 64 * MiB
    member_bytes: int = 16 * MiB
    entries: int = 2048
    ratio: int = 200

    def __post_init__(self):
        for name, cap in (("upload_bytes", 128 * MiB), ("expanded_bytes", 256 * MiB),
                          ("member_bytes", 64 * MiB), ("entries", 8192), ("ratio", 1000)):
            object.__setattr__(self, name, max(1, min(int(getattr(self, name)), cap)))

    @classmethod
    def from_settings(cls, settings):
        defaults = cls()
        return cls(**{name: getattr(settings, "document_max_upload_bytes" if name == "upload_bytes"
                                   else "document_package_" + name, os.environ.get("DOCUMENT_PACKAGE_" + name.upper(), getattr(defaults, name)))
                      for name in cls.__dataclass_fields__})

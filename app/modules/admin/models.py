"""Platform-scoped feature controls."""

from sqlalchemy import JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class FeatureFlag(TimestampMixin, Base):
    __tablename__ = "feature_flags"

    key: Mapped[str] = mapped_column(String(120), primary_key=True)
    is_enabled: Mapped[bool] = mapped_column(default=False)
    description: Mapped[str] = mapped_column(String(500), default="")
    rules: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)

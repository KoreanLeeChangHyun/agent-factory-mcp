"""Authoritative non-working dates used by the planning timeline."""

from collections.abc import Iterable
from datetime import UTC, date, datetime

import holidays


def korean_public_holidays(dates: Iterable[date | None]) -> dict[str, str]:
    """Return Korean public holidays around the active planning years."""
    current_year = datetime.now(UTC).year
    years = {current_year - 1, current_year, current_year + 1}
    for value in dates:
        if value is not None:
            years.update((value.year - 1, value.year, value.year + 1))
    calendar = holidays.country_holidays(
        "KR", years=sorted(years), language="ko", observed=True, categories="public"
    )
    return {value.isoformat(): name for value, name in sorted(calendar.items())}

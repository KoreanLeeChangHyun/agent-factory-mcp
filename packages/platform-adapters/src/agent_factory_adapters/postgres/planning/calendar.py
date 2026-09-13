from __future__ import annotations

from datetime import UTC, date, datetime

import holidays


class KoreanHolidayCalendar:
    def holidays(self, dates: list[object]) -> dict[str, str]:
        current = datetime.now(UTC).year
        years = {current - 1, current, current + 1}
        for value in dates:
            if isinstance(value, date):
                years.update((value.year - 1, value.year, value.year + 1))
        calendar = holidays.country_holidays(
            "KR", years=sorted(years), language="ko", observed=True, categories="public"
        )
        return {day.isoformat(): name for day, name in sorted(calendar.items())}

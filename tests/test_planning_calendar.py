from datetime import date

from app.modules.planning.calendar import korean_public_holidays


def test_korean_public_holidays_include_lunar_and_substitute_dates() -> None:
    calendar = korean_public_holidays([date(2026, 9, 25)])

    assert calendar["2026-09-25"] == "추석"
    assert calendar["2026-03-02"] == "삼일절 대체 휴일"

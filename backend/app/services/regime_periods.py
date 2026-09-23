"""Calendar-aware period calculations for macroeconomic time series.

Monthly and quarterly data must be compared with the matching calendar
period.  Counting rows silently substitutes an older period whenever a
release is missing, which can materially distort year-over-year rates.
Daily and weekly market series intentionally retain observation-count
semantics because weekends and holidays are expected gaps.
"""

from __future__ import annotations

from calendar import monthrange
from datetime import date
import math
from typing import Any, Iterable, TypeAlias


DatedValue: TypeAlias = tuple[date, float]
DatedValues: TypeAlias = list[DatedValue]
SeriesRows: TypeAlias = Iterable[dict[str, Any]] | DatedValues


def _row_date(row: dict[str, Any]) -> date | None:
    value = row.get("date") or row.get("observation_date")
    try:
        return date.fromisoformat(str(value)[:10]) if value else None
    except ValueError:
        return None


def dated_values(rows: SeriesRows) -> DatedValues:
    """Return finite, de-duplicated observations sorted by date."""

    # Higher-level models reuse the same series for many rolling calculations.
    # Accepting an already normalized series avoids reparsing and resorting the
    # complete history for every point in a chart or momentum window.
    if isinstance(rows, list) and (
        not rows
        or (
            isinstance(rows[0], tuple)
            and len(rows[0]) == 2
            and isinstance(rows[0][0], date)
        )
    ):
        return rows  # type: ignore[return-value]

    by_date: dict[date, float] = {}
    for row in rows:
        when = _row_date(row)
        try:
            value = float(row["value"])
        except (KeyError, TypeError, ValueError):
            continue
        if when is not None and math.isfinite(value):
            by_date[when] = value
    return sorted(by_date.items())


def _shift_months(value: date, months: int) -> date:
    ordinal = value.year * 12 + value.month - 1 + months
    year, month_index = divmod(ordinal, 12)
    month = month_index + 1
    return date(year, month, min(value.day, monthrange(year, month)[1]))


def _calendar_target(value: date, frequency: str, periods: int) -> tuple[int, int] | None:
    if frequency == "monthly":
        target = _shift_months(value, -periods)
    elif frequency == "quarterly":
        target = _shift_months(value, -3 * periods)
    else:
        return None
    return target.year, target.month


def period_pair(
    rows: SeriesRows,
    frequency: str,
    periods: int,
    *,
    end_index: int = -1,
) -> tuple[tuple[date, float], tuple[date, float]] | None:
    """Return start/end observations without crossing a missing calendar period."""

    values = dated_values(rows)
    if not values:
        return None
    resolved_end = end_index if end_index >= 0 else len(values) + end_index
    if resolved_end < 0 or resolved_end >= len(values):
        return None
    end = values[resolved_end]
    target = _calendar_target(end[0], frequency, periods)
    if target is None:
        start_index = resolved_end - periods
        return (values[start_index], end) if start_index >= 0 else None
    for candidate in reversed(values[:resolved_end]):
        if (candidate[0].year, candidate[0].month) == target:
            return candidate, end
    return None


def period_delta(
    rows: SeriesRows, frequency: str, periods: int, *, end_index: int = -1,
) -> float | None:
    pair = period_pair(rows, frequency, periods, end_index=end_index)
    return pair[1][1] - pair[0][1] if pair else None


def period_percent_change(
    rows: SeriesRows, frequency: str, periods: int, *, end_index: int = -1,
) -> float | None:
    pair = period_pair(rows, frequency, periods, end_index=end_index)
    if not pair or pair[0][1] == 0:
        return None
    return (pair[1][1] / pair[0][1] - 1) * 100


def annualized_change(
    rows: SeriesRows, frequency: str, periods: int, *, end_index: int = -1,
) -> float | None:
    pair = period_pair(rows, frequency, periods, end_index=end_index)
    if not pair or pair[0][1] <= 0:
        return None
    periods_per_year = 12 if frequency == "monthly" else 4 if frequency == "quarterly" else None
    if periods_per_year is None:
        return None
    return ((pair[1][1] / pair[0][1]) ** (periods_per_year / periods) - 1) * 100


def continuity_gaps(
    rows: SeriesRows, frequency: str, *, lookback_periods: int = 24,
) -> list[str]:
    """List missing monthly/quarterly periods in the recent comparison window."""

    values = dated_values(rows)
    if not values or frequency not in {"monthly", "quarterly"}:
        return []
    step = 1 if frequency == "monthly" else 3
    present = {(when.year, when.month) for when, _ in values}
    latest = values[-1][0]
    earliest = values[0][0]
    result: list[str] = []
    for offset in range(lookback_periods - 1, -1, -1):
        candidate = _shift_months(latest, -step * offset)
        if candidate < earliest:
            continue
        if (candidate.year, candidate.month) not in present:
            result.append(
                f"{candidate.year:04d}-{candidate.month:02d}"
                if frequency == "monthly"
                else f"{candidate.year:04d}-Q{(candidate.month - 1) // 3 + 1}"
            )
    return result

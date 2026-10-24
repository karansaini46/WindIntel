from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from app.schemas.forecasts import WindForecastRecord
from app.services.forecast_selection import (
    select_forecast_for_interval,
    select_forecasts_for_delivery_day,
    ensure_utc
)


def test_single_eligible_forecast():
    cutoff = datetime(2026, 1, 5, 12, 0, tzinfo=timezone.utc)
    interval_time = datetime(2026, 1, 6, 14, 0, tzinfo=timezone.utc)
    
    rec = WindForecastRecord(
        start_time=interval_time,
        publish_time=datetime(2026, 1, 5, 11, 30, tzinfo=timezone.utc),
        generation_mw=5000.0
    )
    
    selected = select_forecast_for_interval([rec], cutoff)
    assert selected is not None
    assert selected.generation_mw == 5000.0
    assert selected.publish_time == datetime(2026, 1, 5, 11, 30, tzinfo=timezone.utc)
    assert selected.lead_time_hours == 26.5  # 26.5 hours between publish and delivery


def test_forecast_published_after_cutoff_is_excluded():
    cutoff = datetime(2026, 1, 5, 12, 0, tzinfo=timezone.utc)
    interval_time = datetime(2026, 1, 6, 14, 0, tzinfo=timezone.utc)
    
    post_cutoff_rec = WindForecastRecord(
        start_time=interval_time,
        publish_time=datetime(2026, 1, 5, 12, 1, tzinfo=timezone.utc),
        generation_mw=9999.0
    )
    
    selected = select_forecast_for_interval([post_cutoff_rec], cutoff)
    assert selected is None, "Forecasts published after decision cutoff must never be selected."


def test_exact_cutoff_timestamp_is_eligible():
    cutoff = datetime(2026, 1, 5, 12, 0, tzinfo=timezone.utc)
    interval_time = datetime(2026, 1, 6, 14, 0, tzinfo=timezone.utc)
    
    rec = WindForecastRecord(
        start_time=interval_time,
        publish_time=datetime(2026, 1, 5, 12, 0, tzinfo=timezone.utc),
        generation_mw=6200.0
    )
    
    selected = select_forecast_for_interval([rec], cutoff)
    assert selected is not None
    assert selected.generation_mw == 6200.0
    assert selected.publish_time == cutoff


def test_forecast_published_one_second_after_cutoff_is_excluded():
    """
    Rigorously verifies boundary condition:
    Forecast published at cutoff + 1 second is excluded from selection.
    """
    cutoff = datetime(2026, 1, 5, 12, 0, 0, tzinfo=timezone.utc)
    interval_time = datetime(2026, 1, 6, 14, 0, 0, tzinfo=timezone.utc)
    
    one_second_after = cutoff + timedelta(seconds=1)
    rec = WindForecastRecord(
        start_time=interval_time,
        publish_time=one_second_after,
        generation_mw=7500.0
    )
    
    selected = select_forecast_for_interval([rec], cutoff)
    assert selected is None, "Forecast published even 1 second after cutoff must be excluded."


def test_selects_latest_eligible_version_among_multiple():
    cutoff = datetime(2026, 1, 5, 12, 0, tzinfo=timezone.utc)
    interval_time = datetime(2026, 1, 6, 10, 0, tzinfo=timezone.utc)
    
    v1 = WindForecastRecord(
        start_time=interval_time,
        publish_time=datetime(2026, 1, 4, 18, 0, tzinfo=timezone.utc),
        generation_mw=3000.0
    )
    v2 = WindForecastRecord(
        start_time=interval_time,
        publish_time=datetime(2026, 1, 5, 6, 0, tzinfo=timezone.utc),
        generation_mw=3500.0
    )
    v3 = WindForecastRecord(  # Latest eligible
        start_time=interval_time,
        publish_time=datetime(2026, 1, 5, 11, 30, tzinfo=timezone.utc),
        generation_mw=4200.0
    )
    v4 = WindForecastRecord(  # Newer globally, but post-cutoff (must be ignored!)
        start_time=interval_time,
        publish_time=datetime(2026, 1, 5, 15, 0, tzinfo=timezone.utc),
        generation_mw=5000.0
    )
    
    selected = select_forecast_for_interval([v1, v2, v3, v4], cutoff)
    assert selected is not None
    assert selected.generation_mw == 4200.0
    assert selected.publish_time == datetime(2026, 1, 5, 11, 30, tzinfo=timezone.utc)
    assert selected.all_versions_count == 4


def test_deterministic_tie_breaking_for_equal_publish_time():
    cutoff = datetime(2026, 1, 5, 12, 0, tzinfo=timezone.utc)
    interval_time = datetime(2026, 1, 6, 10, 0, tzinfo=timezone.utc)
    pub = datetime(2026, 1, 5, 11, 0, tzinfo=timezone.utc)
    
    rec_a = WindForecastRecord(start_time=interval_time, publish_time=pub, generation_mw=4000.0)
    rec_b = WindForecastRecord(start_time=interval_time, publish_time=pub, generation_mw=4500.0)
    
    # Regardless of list order, selection should be completely deterministic
    res1 = select_forecast_for_interval([rec_a, rec_b], cutoff)
    res2 = select_forecast_for_interval([rec_b, rec_a], cutoff)
    assert res1 is not None and res2 is not None
    assert res1.generation_mw == res2.generation_mw
    assert res1.generation_mw == 4500.0


def test_forecast_selection_with_timezone_offsets():
    """
    Verifies that timezone-aware datetimes with non-UTC offsets
    are correctly normalized to UTC without losing eligibility accuracy.
    """
    cutoff = datetime(2026, 1, 5, 12, 0, tzinfo=timezone.utc)
    interval_time = datetime(2026, 1, 6, 14, 0, tzinfo=timezone.utc)
    
    # 12:30 in UTC+1 is 11:30 in UTC -> eligible under 12:00 UTC cutoff
    tz_plus_one = timezone(timedelta(hours=1))
    pub_tz_plus_one = datetime(2026, 1, 5, 12, 30, tzinfo=tz_plus_one)
    
    rec = WindForecastRecord(
        start_time=interval_time,
        publish_time=pub_tz_plus_one,
        generation_mw=5400.0
    )
    
    selected = select_forecast_for_interval([rec], cutoff)
    assert selected is not None
    assert selected.publish_time == datetime(2026, 1, 5, 11, 30, tzinfo=timezone.utc)
    assert selected.generation_mw == 5400.0


def test_delivery_day_forecast_selection_with_missing_intervals():
    cutoff = datetime(2026, 1, 5, 12, 0, tzinfo=timezone.utc)
    t1 = datetime(2026, 1, 6, 0, 0, tzinfo=timezone.utc)
    t2 = datetime(2026, 1, 6, 0, 30, tzinfo=timezone.utc)
    
    # Forecast exists only for t1
    f1 = WindForecastRecord(
        start_time=t1,
        publish_time=datetime(2026, 1, 5, 10, 0, tzinfo=timezone.utc),
        generation_mw=7000.0
    )
    
    results = select_forecasts_for_delivery_day([f1], cutoff, expected_intervals=[t1, t2])
    assert results[t1] is not None
    assert results[t1].generation_mw == 7000.0
    assert results[t2] is None, "Missing interval must be explicitly represented as None"

import math
from datetime import datetime, timezone
import pytest
from app.schemas.actuals import ActualWindRecord
from app.schemas.forecasts import SelectedForecastRecord
from app.schemas.evaluation import IntervalStatus
from app.services.evaluation import (
    calculate_evaluation,
    generate_half_hourly_intervals_for_date
)


def test_generate_intervals_for_standard_day():
    intervals = generate_half_hourly_intervals_for_date("2026-01-06")
    assert len(intervals) == 48
    first_st, first_et, first_sp = intervals[0]
    assert first_sp == 1
    assert first_st == datetime(2026, 1, 6, 0, 0, tzinfo=timezone.utc)
    assert first_et == datetime(2026, 1, 6, 0, 30, tzinfo=timezone.utc)
    
    last_st, last_et, last_sp = intervals[-1]
    assert last_sp == 48
    assert last_st == datetime(2026, 1, 6, 23, 30, tzinfo=timezone.utc)
    assert last_et == datetime(2026, 1, 7, 0, 0, tzinfo=timezone.utc)


def test_generate_intervals_for_spring_dst_transition():
    """
    On the last Sunday of March (2026-03-29), the UK shifts from GMT to BST (clocks jump 01:00 -> 02:00).
    The settlement day has 23 clock hours, which equals exactly 46 settlement periods.
    """
    intervals = generate_half_hourly_intervals_for_date("2026-03-29")
    assert len(intervals) == 46
    assert intervals[0][2] == 1
    assert intervals[-1][2] == 46


def test_generate_intervals_for_autumn_dst_transition():
    """
    On the last Sunday of October (2026-10-25), the UK shifts from BST to GMT (clocks fall back 02:00 -> 01:00).
    The settlement day has 25 clock hours, which equals exactly 50 settlement periods.
    """
    intervals = generate_half_hourly_intervals_for_date("2026-10-25")
    assert len(intervals) == 50
    assert intervals[0][2] == 1
    assert intervals[-1][2] == 50


def test_evaluation_metrics_calculations():
    delivery_date = "2026-01-06"
    decision_date = "2026-01-05"
    cutoff = datetime(2026, 1, 5, 12, 0, tzinfo=timezone.utc)
    
    # 3 mock intervals:
    # 1. 00:00 - F=1000, A=1100 -> err = -100, abs = 100
    # 2. 00:30 - F=2000, A=1900 -> err = +100, abs = 100
    # 3. 01:00 - F=3000, A=3200 -> err = -200, abs = 200
    t1 = datetime(2026, 1, 6, 0, 0, tzinfo=timezone.utc)
    t2 = datetime(2026, 1, 6, 0, 30, tzinfo=timezone.utc)
    t3 = datetime(2026, 1, 6, 1, 0, tzinfo=timezone.utc)
    pub = datetime(2026, 1, 5, 11, 0, tzinfo=timezone.utc)
    
    actuals = [
        ActualWindRecord(start_time=t1, settlement_date=delivery_date, settlement_period=1, generation_mw=1100.0),
        ActualWindRecord(start_time=t2, settlement_date=delivery_date, settlement_period=2, generation_mw=1900.0),
        ActualWindRecord(start_time=t3, settlement_date=delivery_date, settlement_period=3, generation_mw=3200.0),
    ]
    
    selected_forecasts = {
        t1: SelectedForecastRecord(start_time=t1, publish_time=pub, generation_mw=1000.0, lead_time_hours=13.0, decision_cutoff=cutoff),
        t2: SelectedForecastRecord(start_time=t2, publish_time=pub, generation_mw=2000.0, lead_time_hours=13.5, decision_cutoff=cutoff),
        t3: SelectedForecastRecord(start_time=t3, publish_time=pub, generation_mw=3000.0, lead_time_hours=14.0, decision_cutoff=cutoff),
    }
    
    res = calculate_evaluation(
        delivery_date_str=delivery_date,
        decision_date_str=decision_date,
        cutoff_utc=cutoff,
        actuals=actuals,
        selected_forecasts=selected_forecasts
    )
    
    # MAE = (100 + 100 + 200) / 3 = 133.33
    assert res.metrics.mae == 133.33
    # RMSE = sqrt((10000 + 10000 + 40000)/3) = sqrt(20000) = 141.42
    assert res.metrics.rmse == 141.42
    # Bias = (-100 + 100 - 200) / 3 = -66.67
    assert res.metrics.bias == -66.67
    assert res.metrics.matched_intervals == 3


def test_mape_zero_and_low_actual_exclusion():
    delivery_date = "2026-01-06"
    decision_date = "2026-01-05"
    cutoff = datetime(2026, 1, 5, 12, 0, tzinfo=timezone.utc)
    pub = datetime(2026, 1, 5, 11, 0, tzinfo=timezone.utc)
    
    t1 = datetime(2026, 1, 6, 0, 0, tzinfo=timezone.utc)
    t2 = datetime(2026, 1, 6, 0, 30, tzinfo=timezone.utc)
    t3 = datetime(2026, 1, 6, 1, 0, tzinfo=timezone.utc)
    
    # t1: A = 50.0 MW (below threshold 100.0), F = 100.0 MW -> excluded from MAPE
    # t2: A = 100.0 MW (exactly at threshold 100.0) -> excluded from MAPE (at or below)
    # t3: A = 1000.0 MW, F = 1100.0 MW -> included (10% error)
    actuals = [
        ActualWindRecord(start_time=t1, settlement_date=delivery_date, settlement_period=1, generation_mw=50.0),
        ActualWindRecord(start_time=t2, settlement_date=delivery_date, settlement_period=2, generation_mw=100.0),
        ActualWindRecord(start_time=t3, settlement_date=delivery_date, settlement_period=3, generation_mw=1000.0),
    ]
    
    selected_forecasts = {
        t1: SelectedForecastRecord(start_time=t1, publish_time=pub, generation_mw=100.0, lead_time_hours=13.0, decision_cutoff=cutoff),
        t2: SelectedForecastRecord(start_time=t2, publish_time=pub, generation_mw=150.0, lead_time_hours=13.5, decision_cutoff=cutoff),
        t3: SelectedForecastRecord(start_time=t3, publish_time=pub, generation_mw=1100.0, lead_time_hours=14.0, decision_cutoff=cutoff),
    }
    
    res = calculate_evaluation(
        delivery_date_str=delivery_date,
        decision_date_str=decision_date,
        cutoff_utc=cutoff,
        actuals=actuals,
        selected_forecasts=selected_forecasts,
        mape_threshold_mw=100.0
    )
    
    assert res.metrics.mape == 10.0
    assert res.metrics.mape_excluded_count == 2
    assert any("excluded from MAPE" in w for w in res.warnings)


def test_coverage_accounting():
    delivery_date = "2026-01-06"
    decision_date = "2026-01-05"
    cutoff = datetime(2026, 1, 5, 12, 0, tzinfo=timezone.utc)
    pub = datetime(2026, 1, 5, 11, 0, tzinfo=timezone.utc)
    
    t1 = datetime(2026, 1, 6, 0, 0, tzinfo=timezone.utc)
    
    # Only 1 pair matched out of 48 expected
    actuals = [
        ActualWindRecord(start_time=t1, settlement_date=delivery_date, settlement_period=1, generation_mw=2000.0),
    ]
    selected_forecasts = {
        t1: SelectedForecastRecord(start_time=t1, publish_time=pub, generation_mw=2100.0, lead_time_hours=13.0, decision_cutoff=cutoff),
    }
    
    res = calculate_evaluation(
        delivery_date_str=delivery_date,
        decision_date_str=decision_date,
        cutoff_utc=cutoff,
        actuals=actuals,
        selected_forecasts=selected_forecasts
    )
    
    assert res.coverage.expected_intervals == 48
    assert res.coverage.matched_pairs == 1
    assert res.coverage.missing_forecast_count == 47
    assert res.coverage.missing_actual_count == 47
    assert res.coverage.coverage_percent == round(1 / 48 * 100, 1)


def test_empty_datasets_evaluation():
    """
    Rigorously validates behavior when no forecasts or actuals exist for the date.
    Metrics should be None (not 0.0), coverage should be 0%, and status PARTIAL_DATA.
    """
    delivery_date = "2026-01-06"
    decision_date = "2026-01-05"
    cutoff = datetime(2026, 1, 5, 12, 0, tzinfo=timezone.utc)
    
    res = calculate_evaluation(
        delivery_date_str=delivery_date,
        decision_date_str=decision_date,
        cutoff_utc=cutoff,
        actuals=[],
        selected_forecasts={}
    )
    
    assert res.metrics.mae is None
    assert res.metrics.rmse is None
    assert res.metrics.bias is None
    assert res.metrics.mape is None
    assert res.metrics.matched_intervals == 0
    assert res.coverage.matched_pairs == 0
    assert res.coverage.expected_intervals == 48
    assert res.coverage.missing_forecast_count == 48
    assert res.coverage.missing_actual_count == 48
    assert res.retrieval_status == "PARTIAL_DATA"


def test_preserves_genuine_zero_generation():
    """
    Ensures that genuine 0.0 MW generation is preserved and not mistaken for missing data.
    """
    delivery_date = "2026-01-06"
    decision_date = "2026-01-05"
    cutoff = datetime(2026, 1, 5, 12, 0, tzinfo=timezone.utc)
    pub = datetime(2026, 1, 5, 11, 0, tzinfo=timezone.utc)
    t1 = datetime(2026, 1, 6, 0, 0, tzinfo=timezone.utc)
    
    actuals = [
        ActualWindRecord(start_time=t1, settlement_date=delivery_date, settlement_period=1, generation_mw=0.0),
    ]
    selected_forecasts = {
        t1: SelectedForecastRecord(start_time=t1, publish_time=pub, generation_mw=0.0, lead_time_hours=13.0, decision_cutoff=cutoff),
    }
    
    res = calculate_evaluation(
        delivery_date_str=delivery_date,
        decision_date_str=decision_date,
        cutoff_utc=cutoff,
        actuals=actuals,
        selected_forecasts=selected_forecasts
    )
    
    assert res.metrics.matched_intervals == 1
    assert res.metrics.mae == 0.0
    assert res.metrics.rmse == 0.0
    assert res.metrics.bias == 0.0
    assert res.intervals[0].status == IntervalStatus.MATCHED
    assert res.intervals[0].actual_mw == 0.0
    assert res.intervals[0].forecast_mw == 0.0

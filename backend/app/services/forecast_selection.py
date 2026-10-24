from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
from app.schemas.forecasts import WindForecastRecord, SelectedForecastRecord


def ensure_utc(dt: datetime) -> datetime:
    """Ensure a datetime object is timezone-aware and converted to UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def select_forecast_for_interval(
    interval_forecasts: List[WindForecastRecord],
    cutoff_utc: datetime
) -> Optional[SelectedForecastRecord]:
    """
    Given a list of forecast records for a single delivery interval,
    selects the most recent forecast published at or before the decision cutoff.
    
    Tie-breaking rule:
    If two eligible records have the exact same publish_time, tie-break
    deterministically using (generation_mw, index).
    """
    if not interval_forecasts:
        return None
        
    cutoff = ensure_utc(cutoff_utc)
    
    # 1. Filter to eligible records (publish_time <= cutoff)
    eligible = [
        f for f in interval_forecasts
        if ensure_utc(f.publish_time) <= cutoff
    ]
    
    if not eligible:
        return None
        
    # 2. Sort eligible records by publish_time ascending, then generation_mw
    # This guarantees a strictly deterministic selection if duplicate publishTimes exist.
    eligible.sort(key=lambda x: (ensure_utc(x.publish_time), x.generation_mw))
    chosen = eligible[-1]
    
    start_time_utc = ensure_utc(chosen.start_time)
    publish_time_utc = ensure_utc(chosen.publish_time)
    lead_time_hours = (start_time_utc - publish_time_utc).total_seconds() / 3600.0
    
    return SelectedForecastRecord(
        start_time=start_time_utc,
        publish_time=publish_time_utc,
        generation_mw=chosen.generation_mw,
        lead_time_hours=lead_time_hours,
        decision_cutoff=cutoff,
        all_versions_count=len(interval_forecasts)
    )


def select_forecasts_for_delivery_day(
    forecasts: List[WindForecastRecord],
    cutoff_utc: datetime,
    expected_intervals: Optional[List[datetime]] = None
) -> Dict[datetime, Optional[SelectedForecastRecord]]:
    """
    Pure forecast-selection function for an entire delivery day.
    
    Guarantees:
    - Never uses forecasts published after cutoff_utc (anti-leakage guarantee).
    - Never uses actual generation values.
    - Deterministic tie-breaking for identical publish timestamps.
    - Explicit representation of missing forecasts for any expected interval.
    
    Returns a dictionary mapping delivery interval start_time (UTC) to SelectedForecastRecord (or None).
    """
    cutoff = ensure_utc(cutoff_utc)
    
    # Group forecasts by normalized delivery interval start_time
    grouped: Dict[datetime, List[WindForecastRecord]] = {}
    for f in forecasts:
        st_utc = ensure_utc(f.start_time)
        grouped.setdefault(st_utc, []).append(f)
        
    results: Dict[datetime, Optional[SelectedForecastRecord]] = {}
    
    # If expected_intervals is provided, ensure every interval is accounted for
    target_intervals = set(grouped.keys())
    if expected_intervals:
        for exp in expected_intervals:
            target_intervals.add(ensure_utc(exp))
            
    for st in sorted(target_intervals):
        records = grouped.get(st, [])
        results[st] = select_forecast_for_interval(records, cutoff)
        
    return results

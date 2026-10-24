import math
from datetime import datetime, date, time, timedelta, timezone
from typing import Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo
from app.schemas.actuals import ActualWindRecord
from app.schemas.forecasts import SelectedForecastRecord
from app.schemas.evaluation import (
    IntervalStatus,
    IntervalEvaluationRecord,
    EvaluationMetrics,
    CoverageStatistics,
    SettlementPeriodSummary,
    EvaluationResponse
)
from app.services.forecast_selection import ensure_utc


def generate_half_hourly_intervals_for_date(
    delivery_date_str: str,
    market_tz: str = "Europe/London"
) -> List[Tuple[datetime, datetime, int]]:
    """
    Generate all half-hourly delivery intervals for a market settlement date (YYYY-MM-DD)
    in Europe/London market timezone, converted to UTC.
    
    Correctly accounts for:
    - Standard 24-hour days (48 settlement periods)
    - Spring daylight saving switch (23 hours, 46 settlement periods)
    - Autumn daylight saving switch (25 hours, 50 settlement periods)
    
    Returns list of (start_time_utc, end_time_utc, settlement_period).
    """
    tz = ZoneInfo(market_tz)
    d = date.fromisoformat(delivery_date_str)
    next_d = d + timedelta(days=1)
    
    start_local = datetime.combine(d, time(0, 0), tzinfo=tz)
    end_local = datetime.combine(next_d, time(0, 0), tzinfo=tz)
    
    start_utc = start_local.astimezone(timezone.utc)
    end_utc = end_local.astimezone(timezone.utc)
    
    total_seconds = int((end_utc - start_utc).total_seconds())
    interval_seconds = 1800  # 30 minutes
    num_intervals = total_seconds // interval_seconds
    
    intervals = []
    for sp in range(1, num_intervals + 1):
        st = start_utc + timedelta(seconds=(sp - 1) * interval_seconds)
        et = st + timedelta(seconds=interval_seconds)
        intervals.append((st, et, sp))
    return intervals


def calculate_evaluation(
    delivery_date_str: str,
    decision_date_str: str,
    cutoff_utc: datetime,
    actuals: List[ActualWindRecord],
    selected_forecasts: Dict[datetime, Optional[SelectedForecastRecord]],
    cached: bool = False,
    last_retrieved_at: Optional[datetime] = None,
    mape_threshold_mw: float = 100.0,
    market_tz: str = "Europe/London"
) -> EvaluationResponse:
    """
    Rigorously aligns actual metered generation with selected forecasts
    and calculates statistical accuracy metrics and coverage accounting.
    """
    now_utc = ensure_utc(last_retrieved_at or datetime.now(timezone.utc))
    cutoff = ensure_utc(cutoff_utc)
    
    # Map actuals by normalized start_time
    actuals_by_start: Dict[datetime, ActualWindRecord] = {
        ensure_utc(a.start_time): a for a in actuals
    }
    
    expected_intervals = generate_half_hourly_intervals_for_date(delivery_date_str, market_tz)
    
    intervals_eval: List[IntervalEvaluationRecord] = []
    matched_forecasts: List[float] = []
    matched_actuals: List[float] = []
    
    fc_avail_count = 0
    act_avail_count = 0
    matched_count = 0
    
    for st, et, sp in expected_intervals:
        act_rec = actuals_by_start.get(st)
        fc_rec = selected_forecasts.get(st)
        
        has_act = act_rec is not None
        has_fc = fc_rec is not None
        
        if has_act:
            act_avail_count += 1
        if has_fc:
            fc_avail_count += 1
            
        if has_act and has_fc:
            status = IntervalStatus.MATCHED
            matched_count += 1
            fc_val = fc_rec.generation_mw
            act_val = act_rec.generation_mw
            err_val = fc_val - act_val
            abs_err = abs(err_val)
            
            matched_forecasts.append(fc_val)
            matched_actuals.append(act_val)
            
            intervals_eval.append(IntervalEvaluationRecord(
                start_time=st,
                end_time=et,
                settlement_date=delivery_date_str,
                settlement_period=sp,
                actual_mw=act_val,
                forecast_mw=fc_val,
                error_mw=round(err_val, 2),
                abs_error_mw=round(abs_err, 2),
                publish_time=fc_rec.publish_time,
                lead_time_hours=round(fc_rec.lead_time_hours, 2),
                status=status
            ))
        elif has_act and not has_fc:
            intervals_eval.append(IntervalEvaluationRecord(
                start_time=st,
                end_time=et,
                settlement_date=delivery_date_str,
                settlement_period=sp,
                actual_mw=act_rec.generation_mw,
                forecast_mw=None,
                error_mw=None,
                abs_error_mw=None,
                publish_time=None,
                lead_time_hours=None,
                status=IntervalStatus.MISSING_FORECAST
            ))
        elif not has_act and has_fc:
            intervals_eval.append(IntervalEvaluationRecord(
                start_time=st,
                end_time=et,
                settlement_date=delivery_date_str,
                settlement_period=sp,
                actual_mw=None,
                forecast_mw=fc_rec.generation_mw,
                error_mw=None,
                abs_error_mw=None,
                publish_time=fc_rec.publish_time,
                lead_time_hours=round(fc_rec.lead_time_hours, 2),
                status=IntervalStatus.MISSING_ACTUAL
            ))
        else:
            intervals_eval.append(IntervalEvaluationRecord(
                start_time=st,
                end_time=et,
                settlement_date=delivery_date_str,
                settlement_period=sp,
                actual_mw=None,
                forecast_mw=None,
                error_mw=None,
                abs_error_mw=None,
                publish_time=None,
                lead_time_hours=None,
                status=IntervalStatus.UNPAIRED
            ))
            
    # Compute Metrics strictly on valid matched pairs
    n = len(matched_forecasts)
    mae: Optional[float] = None
    rmse: Optional[float] = None
    bias: Optional[float] = None
    mape: Optional[float] = None
    mape_excluded = 0
    
    if n > 0:
        errors = [f - a for f, a in zip(matched_forecasts, matched_actuals)]
        abs_errors = [abs(e) for e in errors]
        squared_errors = [e ** 2 for e in errors]
        
        mae = round(sum(abs_errors) / n, 2)
        rmse = round(math.sqrt(sum(squared_errors) / n), 2)
        bias = round(sum(errors) / n, 2)
        
        # MAPE calculation excluding zero / low actuals (actual <= mape_threshold_mw)
        valid_percentage_errors = []
        for f, a in zip(matched_forecasts, matched_actuals):
            if a > mape_threshold_mw:
                valid_percentage_errors.append(abs(f - a) / a * 100.0)
            else:
                mape_excluded += 1
                
        if valid_percentage_errors:
            mape = round(sum(valid_percentage_errors) / len(valid_percentage_errors), 2)
            
    expected_count = len(expected_intervals)
    coverage_pct = round((matched_count / expected_count * 100.0) if expected_count > 0 else 0.0, 1)
    
    metrics = EvaluationMetrics(
        mae=mae,
        rmse=rmse,
        bias=bias,
        mape=mape,
        mape_excluded_count=mape_excluded,
        matched_intervals=n,
        coverage_percent=coverage_pct
    )
    
    coverage = CoverageStatistics(
        expected_intervals=expected_count,
        forecast_intervals_available=fc_avail_count,
        actual_intervals_available=act_avail_count,
        matched_pairs=matched_count,
        missing_forecast_count=expected_count - fc_avail_count,
        missing_actual_count=expected_count - act_avail_count,
        coverage_percent=coverage_pct,
        notes=(
            f"Elexon WINDFOR forecasts are published by NESO at hourly resolution, yielding ~{fc_avail_count} "
            f"forecasted settlement periods per day. FUELHH actuals are reported half-hourly ({expected_count} periods expected). "
            "Unpaired intervals are strictly excluded from accuracy metrics."
        )
    )
    
    # Settlement Period Summary (hourly / half-hourly diurnal pattern)
    sp_summary: List[SettlementPeriodSummary] = []
    for item in intervals_eval:
        sp_summary.append(SettlementPeriodSummary(
            settlement_period=item.settlement_period,
            forecast_mw=item.forecast_mw,
            actual_mw=item.actual_mw,
            error_mw=item.error_mw,
            matched_count=1 if item.status == IntervalStatus.MATCHED else 0
        ))
        
    warnings: List[str] = []
    if coverage_pct < 100.0:
        warnings.append(
            f"Forecast coverage is {coverage_pct}% ({matched_count}/{expected_count} intervals). "
            f"WINDFOR provides hourly projections while FUELHH provides half-hourly metered outturns."
        )
    if mape_excluded > 0:
        warnings.append(
            f"{mape_excluded} interval(s) with actual generation <= {mape_threshold_mw} MW were excluded from MAPE to prevent percentage distortion."
        )
        
    return EvaluationResponse(
        decision_date=decision_date_str,
        decision_cutoff=cutoff,
        delivery_date=delivery_date_str,
        timezone=market_tz,
        unit="MW",
        data_source="Elexon BMRS (FUELHH + WINDFOR)",
        retrieval_status="SUCCESS" if matched_count > 0 else "PARTIAL_DATA",
        cached=cached,
        last_retrieved_at=now_utc,
        metrics=metrics,
        coverage=coverage,
        intervals=intervals_eval,
        sp_summary=sp_summary,
        warnings=warnings
    )

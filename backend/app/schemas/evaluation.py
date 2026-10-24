from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class IntervalStatus(str, Enum):
    MATCHED = "MATCHED"
    MISSING_FORECAST = "MISSING_FORECAST"
    MISSING_ACTUAL = "MISSING_ACTUAL"
    UNPAIRED = "UNPAIRED"


class IntervalEvaluationRecord(BaseModel):
    """
    Evaluated delivery interval combining metered actuals and selected forecast.
    """
    start_time: datetime = Field(..., description="Interval start timestamp (UTC)")
    end_time: datetime = Field(..., description="Interval end timestamp (UTC)")
    settlement_date: str = Field(..., description="Settlement calendar date (YYYY-MM-DD)")
    settlement_period: int = Field(..., description="Settlement period index")
    actual_mw: Optional[float] = Field(default=None, description="Actual metered generation in MW")
    forecast_mw: Optional[float] = Field(default=None, description="Selected forecast in MW")
    error_mw: Optional[float] = Field(default=None, description="Forecast Error: Forecast - Actual (MW)")
    abs_error_mw: Optional[float] = Field(default=None, description="Absolute Forecast Error |Forecast - Actual| (MW)")
    publish_time: Optional[datetime] = Field(default=None, description="Publication timestamp of selected forecast")
    lead_time_hours: Optional[float] = Field(default=None, description="Lead time (start_time - publish_time) in hours")
    status: IntervalStatus = Field(..., description="Data completeness status of interval")


class EvaluationMetrics(BaseModel):
    """
    Accuracy metrics computed strictly on valid matched forecast-actual pairs.
    """
    mae: Optional[float] = Field(default=None, description="Mean Absolute Error (MW). Lower is better.")
    rmse: Optional[float] = Field(default=None, description="Root Mean Squared Error (MW). Penalizes outliers.")
    bias: Optional[float] = Field(default=None, description="Mean Signed Error / Bias (MW). Positive = overforecast.")
    mape: Optional[float] = Field(default=None, description="Mean Absolute Percentage Error (%).")
    mape_excluded_count: int = Field(default=0, description="Count of intervals with actual < threshold excluded from MAPE")
    matched_intervals: int = Field(default=0, description="Denominator used for accuracy metrics")
    coverage_percent: float = Field(default=0.0, description="Matched pairs / expected intervals * 100")


class CoverageStatistics(BaseModel):
    """
    Rigorous accounting of expected vs available intervals.
    """
    expected_intervals: int = Field(..., description="Expected delivery intervals for the day (usually 48)")
    forecast_intervals_available: int = Field(..., description="Intervals with an eligible forecast")
    actual_intervals_available: int = Field(..., description="Intervals with metered actual generation")
    matched_pairs: int = Field(..., description="Intervals with both forecast and actual present")
    missing_forecast_count: int = Field(..., description="Intervals missing forecast data")
    missing_actual_count: int = Field(..., description="Intervals missing metered outturn")
    coverage_percent: float = Field(..., description="Percentage of expected intervals matched")
    notes: str = Field(default="", description="Explanatory notes on interval granularity and availability")


class SettlementPeriodSummary(BaseModel):
    """
    Settlement period aggregation for diurnal accuracy analysis.
    """
    settlement_period: int = Field(..., description="Settlement period number (1-48)")
    forecast_mw: Optional[float] = None
    actual_mw: Optional[float] = None
    error_mw: Optional[float] = None
    matched_count: int = 0


class EvaluationResponse(BaseModel):
    """
    Full evaluation payload returned by GET /api/evaluation.
    """
    decision_date: str = Field(..., description="Selected day-ahead decision date (YYYY-MM-DD)")
    decision_cutoff: datetime = Field(..., description="Effective cutoff timestamp (UTC)")
    delivery_date: str = Field(..., description="Evaluated delivery date (YYYY-MM-DD)")
    timezone: str = Field(default="Europe/London", description="Market timezone")
    unit: str = Field(default="MW", description="Generation unit")
    data_source: str = Field(default="Elexon BMRS (FUELHH + WINDFOR)", description="Data provider")
    retrieval_status: str = Field(default="SUCCESS", description="SUCCESS, PARTIAL_DATA, or ERROR")
    cached: bool = Field(default=False, description="Whether data was served from persistent cache")
    last_retrieved_at: datetime = Field(..., description="Timestamp of data retrieval")
    metrics: EvaluationMetrics
    coverage: CoverageStatistics
    intervals: List[IntervalEvaluationRecord] = Field(default_factory=list)
    sp_summary: List[SettlementPeriodSummary] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)

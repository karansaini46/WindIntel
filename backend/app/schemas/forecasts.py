from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class WindForecastRecord(BaseModel):
    """
    Raw forecast record from Elexon WINDFOR dataset.
    """
    start_time: datetime = Field(..., description="Target delivery interval start timestamp (UTC)")
    publish_time: datetime = Field(..., description="When this forecast was published by NESO (UTC)")
    generation_mw: float = Field(..., description="Forecasted wind generation in MW")
    settlement_date: Optional[str] = Field(default=None, description="Target settlement date")
    settlement_period: Optional[int] = Field(default=None, description="Target settlement period")


class SelectedForecastRecord(BaseModel):
    """
    Forecast version chosen by the deterministic selection algorithm
    for a specific delivery interval under a decision cutoff.
    """
    start_time: datetime = Field(..., description="Target delivery interval start timestamp (UTC)")
    publish_time: datetime = Field(..., description="Selected forecast publication timestamp (UTC)")
    generation_mw: float = Field(..., description="Selected forecast value in MW")
    lead_time_hours: float = Field(..., description="Lead time in hours: start_time - publish_time")
    decision_cutoff: datetime = Field(..., description="Decision cutoff used for eligibility")
    all_versions_count: int = Field(default=1, description="Total forecast versions available for this interval")


class ForecastHistoryVersion(BaseModel):
    """
    Individual forecast revision in the publication history timeline.
    """
    publish_time: datetime = Field(..., description="Publication timestamp (UTC)")
    generation_mw: float = Field(..., description="Forecasted wind generation in MW")
    eligible: bool = Field(..., description="Whether this version was published at or before decision cutoff")
    lead_time_hours: float = Field(..., description="Lead time from publication to interval delivery")
    is_selected: bool = Field(default=False, description="Whether this was the chosen version under the cutoff")


class ForecastHistoryResponse(BaseModel):
    """
    Full publication evolution trail for a single delivery interval.
    """
    start_time: datetime = Field(..., description="Target delivery interval start timestamp (UTC)")
    settlement_date: Optional[str] = None
    settlement_period: Optional[int] = None
    decision_cutoff: Optional[datetime] = None
    selected_version: Optional[ForecastHistoryVersion] = None
    versions_count: int = 0
    versions: List[ForecastHistoryVersion] = Field(default_factory=list)

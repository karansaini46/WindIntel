from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class ActualWindRecord(BaseModel):
    """
    Validated metered wind generation record derived from Elexon FUELHH.
    """
    start_time: datetime = Field(..., description="Start of delivery settlement period (UTC)")
    settlement_date: str = Field(..., description="Settlement calendar date (YYYY-MM-DD)")
    settlement_period: int = Field(..., ge=1, le=50, description="Half-hourly settlement period index (1-48, or 46/50 on DST)")
    generation_mw: float = Field(..., description="Actual metered wind generation in MW")
    fuel_type: str = Field(default="WIND", description="Fuel type category (filtered to WIND)")
    publish_time: Optional[datetime] = Field(default=None, description="When outturn was published to BMRS")


class ActualsFilterParams(BaseModel):
    settlement_date_from: str
    settlement_date_to: str
    fuel_type: str = "WIND"

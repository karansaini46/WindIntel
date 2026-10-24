from datetime import datetime
from typing import Dict, Optional
from pydantic import BaseModel, Field


class SupportedDateRange(BaseModel):
    start: str
    end: str


class SystemMetadataResponse(BaseModel):
    supported_decision_dates: SupportedDateRange
    supported_delivery_dates: SupportedDateRange
    timezone: str = "Europe/London"
    generation_unit: str = "MW"
    default_cutoff_time: str = "12:00:00"
    data_source: str = "Elexon Insights Solution (BMRS)"
    datasets: Dict[str, str] = {
        "actuals": "FUELHH (fuelType=WIND)",
        "forecasts": "WINDFOR",
        "evolution": "/forecast/generation/wind/evolution"
    }
    last_successful_retrieval: Optional[datetime] = None
    app_version: str = "1.0.0"


class HealthCheckResponse(BaseModel):
    status: str = "healthy"
    version: str = "1.0.0"
    timestamp: datetime
    cache_connected: bool = True
    upstream_api: str

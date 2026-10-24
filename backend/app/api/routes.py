from datetime import date, datetime, time, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from app.core.config import Settings, get_settings
from app.core.logging import logger
from app.clients.elexon import ElexonClient, ElexonApiError, get_elexon_client
from app.schemas.evaluation import EvaluationResponse
from app.schemas.forecasts import ForecastHistoryResponse
from app.schemas.metadata import SystemMetadataResponse, HealthCheckResponse, SupportedDateRange
from app.services.forecast_selection import select_forecasts_for_delivery_day, ensure_utc
from app.services.evaluation import calculate_evaluation, generate_half_hourly_intervals_for_date
from app.services.export import generate_evaluation_csv

router = APIRouter(prefix="/api", tags=["WindIntel API"])


def parse_decision_cutoff(
    decision_date_str: str,
    cutoff_time_str: str,
    tz_name: str = "Europe/London"
) -> datetime:
    """
    Parses decision date and cutoff time in Europe/London timezone,
    handling DST/GMT and converting to UTC.
    """
    try:
        d = date.fromisoformat(decision_date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid decision_date format. Must be YYYY-MM-DD.")
        
    try:
        parts = list(map(int, cutoff_time_str.split(":")))
        if len(parts) == 2:
            t = time(parts[0], parts[1], 0)
        elif len(parts) == 3:
            t = time(parts[0], parts[1], parts[2])
        else:
            raise ValueError()
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid decision_cutoff format. Must be HH:MM or HH:MM:SS."
        )
        
    local_tz = ZoneInfo(tz_name)
    local_dt = datetime.combine(d, t, tzinfo=local_tz)
    return local_dt.astimezone(timezone.utc)


@router.get("/health", response_model=HealthCheckResponse)
async def health_check(
    settings: Settings = Depends(get_settings),
    client: ElexonClient = Depends(get_elexon_client)
):
    cache_ok = client.cache.check_health()
    status = "healthy" if cache_ok else "degraded"
    return HealthCheckResponse(
        status=status,
        version="1.0.0",
        timestamp=datetime.now(timezone.utc),
        cache_connected=cache_ok,
        upstream_api=settings.ELEXON_API_BASE_URL
    )


@router.get("/metadata", response_model=SystemMetadataResponse)
async def get_metadata(
    settings: Settings = Depends(get_settings),
    client: ElexonClient = Depends(get_elexon_client)
):
    last_retrieval = client.cache.get_last_successful_retrieval()
    return SystemMetadataResponse(
        supported_decision_dates=SupportedDateRange(
            start=settings.DATA_START_DATE,
            end=settings.DATA_END_DATE
        ),
        supported_delivery_dates=SupportedDateRange(
            start="2026-01-02",
            end="2026-02-01"
        ),
        timezone=settings.MARKET_TIMEZONE,
        generation_unit=settings.GENERATION_UNIT,
        default_cutoff_time=settings.DEFAULT_DECISION_CUTOFF,
        data_source="Elexon Insights Solution (BMRS)",
        last_successful_retrieval=last_retrieval
    )


@router.get("/evaluation", response_model=EvaluationResponse)
async def get_evaluation(
    decision_date: str = Query(..., description="Day-ahead decision date (YYYY-MM-DD, e.g. 2026-01-05)"),
    decision_cutoff: Optional[str] = Query(None, description="Purchasing cutoff time (HH:MM:SS, defaults to 12:00:00)"),
    delivery_date: Optional[str] = Query(None, description="Target delivery date (defaults to decision_date + 1 day)"),
    force_refresh: bool = Query(False, description="Bypass cache and query upstream API"),
    settings: Settings = Depends(get_settings),
    client: ElexonClient = Depends(get_elexon_client)
):
    """
    Evaluates wind generation forecasts available at the decision cutoff
    against metered actuals for the delivery day.
    """
    # 1. Parse and validate decision date
    try:
        dec_d = date.fromisoformat(decision_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid decision_date format (expected YYYY-MM-DD).")
        
    # Check date range limits
    if decision_date < settings.DATA_START_DATE or decision_date > settings.DATA_END_DATE:
        raise HTTPException(
            status_code=400,
            detail=f"decision_date {decision_date} is outside the supported January 2026 evaluation period ({settings.DATA_START_DATE} to {settings.DATA_END_DATE})."
        )
        
    cutoff_time = decision_cutoff or settings.DEFAULT_DECISION_CUTOFF
    cutoff_utc = parse_decision_cutoff(decision_date, cutoff_time, settings.MARKET_TIMEZONE)
    
    deliv_date_str = delivery_date or (dec_d + timedelta(days=1)).isoformat()
    
    # 2. Fetch Actuals for delivery date
    try:
        actuals = await client.get_actual_wind_generation(
            settlement_date_from=deliv_date_str,
            settlement_date_to=deliv_date_str,
            force_refresh=force_refresh
        )
    except ElexonApiError as e:
        logger.error(f"Failed to fetch actuals: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Error retrieving actual wind generation from Elexon BMRS: {e.message}"
        )
        
    # 3. Fetch Forecasts published up to cutoff
    # Forecasts for delivery date are published up to 48 hours prior.
    # Query window: from 3 days prior to cutoff up to cutoff + 1 hour
    pub_from = cutoff_utc - timedelta(days=3)
    pub_to = cutoff_utc + timedelta(hours=1)
    
    try:
        forecasts = await client.get_wind_forecasts(
            publish_datetime_from=pub_from,
            publish_datetime_to=pub_to,
            force_refresh=force_refresh
        )
    except ElexonApiError as e:
        logger.error(f"Failed to fetch forecasts: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Error retrieving wind forecasts from Elexon BMRS: {e.message}"
        )
        
    # 4. Expected intervals according to market timezone (Europe/London)
    expected_tuples = generate_half_hourly_intervals_for_date(deliv_date_str, settings.MARKET_TIMEZONE)
    expected_start_times = [st for st, _, _ in expected_tuples]
    day_start_utc = expected_tuples[0][0]
    day_end_utc = expected_tuples[-1][1]
    
    # 5. Filter forecasts targeting the delivery date
    target_forecasts = [
        f for f in forecasts
        if (day_start_utc <= ensure_utc(f.start_time) < day_end_utc)
        or (f.settlement_date == deliv_date_str)
    ]
    
    # 6. Apply pure cutoff-based selection algorithm
    selected_map = select_forecasts_for_delivery_day(
        forecasts=target_forecasts,
        cutoff_utc=cutoff_utc,
        expected_intervals=expected_start_times
    )
    
    # 7. Compute evaluation metrics
    last_ts = client.cache.get_last_successful_retrieval() or datetime.now(timezone.utc)
    evaluation = calculate_evaluation(
        delivery_date_str=deliv_date_str,
        decision_date_str=decision_date,
        cutoff_utc=cutoff_utc,
        actuals=actuals,
        selected_forecasts=selected_map,
        cached=client.last_query_was_cached,
        last_retrieved_at=last_ts,
        market_tz=settings.MARKET_TIMEZONE
    )
    
    return evaluation


@router.get("/forecast-history", response_model=ForecastHistoryResponse)
async def get_forecast_history(
    start_time: str = Query(..., description="Target delivery interval start timestamp in ISO-8601 (e.g. 2026-01-06T12:00:00Z)"),
    decision_cutoff: Optional[str] = Query(None, description="Optional decision cutoff ISO-8601 UTC timestamp to flag eligible versions"),
    client: ElexonClient = Depends(get_elexon_client)
):
    """
    Returns the complete chronological publication revision history for a delivery interval.
    """
    try:
        st_dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid start_time ISO timestamp format.")
        
    cutoff_dt = None
    if decision_cutoff:
        try:
            cutoff_dt = datetime.fromisoformat(decision_cutoff.replace("Z", "+00:00"))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid decision_cutoff ISO timestamp format.")
            
    try:
        evolution = await client.get_forecast_evolution(
            delivery_start_time=st_dt,
            decision_cutoff=cutoff_dt
        )
        return evolution
    except ElexonApiError as e:
        logger.error(f"Failed to fetch forecast evolution: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Error retrieving forecast evolution from Elexon BMRS: {e.message}"
        )


@router.get("/export")
async def export_evaluation_csv(
    decision_date: str = Query(..., description="Day-ahead decision date (YYYY-MM-DD)"),
    decision_cutoff: Optional[str] = Query(None, description="Purchasing cutoff time"),
    delivery_date: Optional[str] = Query(None, description="Target delivery date"),
    settings: Settings = Depends(get_settings),
    client: ElexonClient = Depends(get_elexon_client)
):
    """
    Generates and downloads standardized RFC 4180 CSV export of evaluated intervals.
    """
    evaluation = await get_evaluation(
        decision_date=decision_date,
        decision_cutoff=decision_cutoff,
        delivery_date=delivery_date,
        force_refresh=False,
        settings=settings,
        client=client
    )
    
    csv_content = generate_evaluation_csv(evaluation)
    filename = f"windintel_eval_{decision_date}.csv"
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache"
        }
    )

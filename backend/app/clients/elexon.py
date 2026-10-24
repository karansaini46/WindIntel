import asyncio
import math
from datetime import datetime, date, timedelta, timezone
from typing import Any, Dict, List, Optional, Set, Tuple
import httpx
from app.core.config import get_settings
from app.core.logging import logger
from app.db.cache import SQLiteCache, get_cache
from app.schemas.actuals import ActualWindRecord
from app.schemas.forecasts import (
    WindForecastRecord,
    ForecastHistoryVersion,
    ForecastHistoryResponse
)
from app.services.forecast_selection import ensure_utc, select_forecast_for_interval


class ElexonApiError(Exception):
    """Custom exception raised when an upstream Elexon API call fails."""
    def __init__(self, message: str, status_code: Optional[int] = None, details: Any = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details


def parse_generation_mw(raw_val: Any) -> Optional[float]:
    """
    Validates that generation exists and is numeric.
    Preserves legitimate zero values (0.0).
    Returns None if value is missing, None, NaN, inf, or unparseable.
    Does NOT silently turn missing generation into zero.
    Does NOT silently clamp unexpected negative values to zero.
    """
    if raw_val is None:
        return None
    if isinstance(raw_val, (int, float)):
        val = float(raw_val)
        if math.isnan(val) or math.isinf(val):
            return None
        return val
    if isinstance(raw_val, str):
        val_str = raw_val.strip()
        if not val_str or val_str.lower() in ("null", "none", "nan", "missing", ""):
            return None
        try:
            val = float(val_str)
            if math.isnan(val) or math.isinf(val):
                return None
            return val
        except ValueError:
            return None
    return None


def extract_dataset_records(resp_json: Any) -> List[Dict[str, Any]]:
    """
    Safely extracts record list from Elexon API responses.
    Handles responses that are direct lists, dictionaries containing a 'data' property,
    or dictionaries containing an 'items' property.
    """
    if isinstance(resp_json, list):
        return resp_json
    elif isinstance(resp_json, dict):
        if "data" in resp_json and isinstance(resp_json["data"], list):
            return resp_json["data"]
        elif "items" in resp_json and isinstance(resp_json["items"], list):
            return resp_json["items"]
        return []
    return []


class ElexonClient:
    """
    Robust HTTP client for the official Elexon Insights Solution (BMRS) API.
    Handles chunking for date ranges exceeding 7 days, persistent caching,
    timeout management, deduplication across chunk boundaries, and exponential
    backoff on transient failures.
    """
    def __init__(
        self,
        base_url: Optional[str] = None,
        cache: Optional[SQLiteCache] = None,
        timeout_seconds: Optional[float] = None
    ):
        settings = get_settings()
        self.base_url = (base_url or settings.ELEXON_API_BASE_URL).rstrip("/")
        self.cache = cache or get_cache(settings.CACHE_DB_PATH)
        self.timeout = httpx.Timeout(
            timeout_seconds or settings.REQUEST_TIMEOUT_SECONDS,
            connect=10.0
        )
        self.max_retries = settings.MAX_RETRIES
        self.backoff_factor = settings.RETRY_BACKOFF_FACTOR
        self._client: Optional[httpx.AsyncClient] = None
        self.last_query_was_cached: bool = False
        self.diagnostics_excluded_records: int = 0

    async def get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=self.timeout,
                headers={"User-Agent": "WindIntel-Client/1.0", "Accept": "application/json"}
            )
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def _request_with_retry(
        self,
        endpoint: str,
        params: Dict[str, Any]
    ) -> Any:
        """
        Executes a GET request against Elexon BMRS with bounded exponential backoff.
        """
        client = await self.get_client()
        url = f"{self.base_url}{endpoint}"
        last_error: Optional[Exception] = None

        for attempt in range(self.max_retries + 1):
            try:
                logger.debug(f"Elexon GET {url} params={params} (attempt {attempt + 1})")
                resp = await client.get(url, params=params)
                
                if resp.status_code == 200:
                    try:
                        return resp.json()
                    except Exception as json_err:
                        raise ElexonApiError(
                            f"Malformed JSON response from {url}: {json_err}",
                            status_code=200
                        )
                elif resp.status_code in (429, 500, 502, 503, 504):
                    logger.warning(
                        f"Transient HTTP {resp.status_code} from {url}. Retrying..."
                    )
                    last_error = ElexonApiError(
                        f"Upstream server error HTTP {resp.status_code}",
                        status_code=resp.status_code,
                        details=resp.text
                    )
                else:
                    # Client errors (400, 404, etc.) are non-retryable
                    raise ElexonApiError(
                        f"Elexon API client error HTTP {resp.status_code}: {resp.text}",
                        status_code=resp.status_code,
                        details=resp.text
                    )
            except (httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout) as net_err:
                logger.warning(f"Network error connecting to Elexon {url}: {net_err}")
                last_error = ElexonApiError(f"Network connectivity error: {net_err}")
                
            if attempt < self.max_retries:
                delay = self.backoff_factor * (2 ** attempt)
                await asyncio.sleep(delay)

        raise last_error or ElexonApiError("Failed after maximum retries")

    async def get_actual_wind_generation(
        self,
        settlement_date_from: str,
        settlement_date_to: str,
        force_refresh: bool = False
    ) -> List[ActualWindRecord]:
        """
        Retrieves metered wind generation from FUELHH dataset for settlement dates.
        Splits date ranges exceeding 5 days into safe chunks to satisfy the 7-day API limit.
        Deduplicates shared boundary records and validates numeric generation values.
        """
        d_from = date.fromisoformat(settlement_date_from)
        d_to = date.fromisoformat(settlement_date_to)
        
        all_records: List[ActualWindRecord] = []
        seen_keys: Set[Tuple[str, int, str]] = set()
        all_cached = True
        
        curr_from = d_from
        while curr_from <= d_to:
            curr_to = min(curr_from + timedelta(days=4), d_to)
            chunk_from_str = curr_from.isoformat()
            chunk_to_str = curr_to.isoformat()
            
            cache_key = f"FUELHH:WIND:{chunk_from_str}:{chunk_to_str}"
            raw_data = None
            if not force_refresh:
                raw_data = self.cache.get(cache_key)
                
            if raw_data is None:
                all_cached = False
                params = {
                    "settlementDateFrom": chunk_from_str,
                    "settlementDateTo": chunk_to_str,
                    "fuelType": "WIND"
                }
                resp_json = await self._request_with_retry("/datasets/FUELHH", params)
                raw_data = extract_dataset_records(resp_json)
                self.cache.set(cache_key, "FUELHH", params, raw_data)
            else:
                raw_data = extract_dataset_records(raw_data)
                
            for item in raw_data:
                try:
                    if item.get("fuelType") != "WIND":
                        continue
                        
                    gen = parse_generation_mw(item.get("generation"))
                    if gen is None:
                        self.diagnostics_excluded_records += 1
                        logger.warning(
                            f"FUELHH record excluded: missing or invalid generation '{item.get('generation')}' "
                            f"at settlementDate={item.get('settlementDate')} SP={item.get('settlementPeriod')}"
                        )
                        continue
                        
                    st = ensure_utc(datetime.fromisoformat(item["startTime"]))
                    s_date = item["settlementDate"]
                    sp = int(item["settlementPeriod"])
                    
                    # Deduplicate across chunk boundaries
                    key = (s_date, sp, "WIND")
                    if key in seen_keys:
                        continue
                    seen_keys.add(key)
                    
                    all_records.append(ActualWindRecord(
                        start_time=st,
                        settlement_date=s_date,
                        settlement_period=sp,
                        generation_mw=gen,
                        fuel_type="WIND",
                        publish_time=ensure_utc(datetime.fromisoformat(item["publishTime"])) if item.get("publishTime") else None
                    ))
                except Exception as parse_err:
                    self.diagnostics_excluded_records += 1
                    logger.debug(f"Skipping unparseable FUELHH record: {parse_err}")
                    
            curr_from = curr_to + timedelta(days=1)
            
        self.last_query_was_cached = all_cached
        return all_records

    async def get_wind_forecasts(
        self,
        publish_datetime_from: datetime,
        publish_datetime_to: datetime,
        force_refresh: bool = False
    ) -> List[WindForecastRecord]:
        """
        Retrieves wind forecasts published between publish_datetime_from and publish_datetime_to.
        Splits ranges exceeding 5 days to stay well below the 7-day API ceiling.
        Deduplicates shared boundary records while preserving distinct forecast revisions.
        """
        from_utc = ensure_utc(publish_datetime_from)
        to_utc = ensure_utc(publish_datetime_to)
        
        all_records: List[WindForecastRecord] = []
        seen_keys: Set[Tuple[datetime, datetime, float, Optional[str], Optional[int]]] = set()
        all_cached = True
        
        curr_from = from_utc
        while curr_from < to_utc:
            curr_to = min(curr_from + timedelta(days=4), to_utc)
            from_iso = curr_from.strftime("%Y-%m-%dT%H:%M:%SZ")
            to_iso = curr_to.strftime("%Y-%m-%dT%H:%M:%SZ")
            
            cache_key = f"WINDFOR:{from_iso}:{to_iso}"
            raw_data = None
            if not force_refresh:
                raw_data = self.cache.get(cache_key)
                
            if raw_data is None:
                all_cached = False
                params = {
                    "publishDateTimeFrom": from_iso,
                    "publishDateTimeTo": to_iso
                }
                resp_json = await self._request_with_retry("/datasets/WINDFOR", params)
                raw_data = extract_dataset_records(resp_json)
                self.cache.set(cache_key, "WINDFOR", params, raw_data)
            else:
                raw_data = extract_dataset_records(raw_data)
                
            for item in raw_data:
                try:
                    gen = parse_generation_mw(item.get("generation"))
                    if gen is None:
                        self.diagnostics_excluded_records += 1
                        logger.warning(
                            f"WINDFOR record excluded: missing or invalid generation '{item.get('generation')}' "
                            f"for startTime={item.get('startTime')}"
                        )
                        continue
                        
                    st = ensure_utc(datetime.fromisoformat(item["startTime"]))
                    pub = ensure_utc(datetime.fromisoformat(item["publishTime"]))
                    s_date = item.get("settlementDate")
                    sp = int(item["settlementPeriod"]) if item.get("settlementPeriod") is not None else None
                    
                    # Deduplicate across shared chunk boundaries
                    key = (st, pub, gen, s_date, sp)
                    if key in seen_keys:
                        continue
                    seen_keys.add(key)
                    
                    all_records.append(WindForecastRecord(
                        start_time=st,
                        publish_time=pub,
                        generation_mw=gen,
                        settlement_date=s_date,
                        settlement_period=sp
                    ))
                except Exception as parse_err:
                    self.diagnostics_excluded_records += 1
                    logger.debug(f"Skipping unparseable WINDFOR record: {parse_err}")
                    
            curr_from = curr_to
            
        self.last_query_was_cached = all_cached
        return all_records

    async def get_forecast_evolution(
        self,
        delivery_start_time: datetime,
        decision_cutoff: Optional[datetime] = None
    ) -> ForecastHistoryResponse:
        """
        Retrieves the complete revision history for a single delivery interval.
        Uses official /forecast/generation/wind/evolution endpoint.
        Guarantees deterministic selection consistent with select_forecast_for_interval.
        """
        st_utc = ensure_utc(delivery_start_time)
        st_iso = st_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
        cutoff = ensure_utc(decision_cutoff) if decision_cutoff else None
        
        cache_key = f"EVOLUTION:{st_iso}"
        raw_data = self.cache.get(cache_key)
        
        if raw_data is None:
            params = {"startTime": st_iso}
            resp_json = await self._request_with_retry("/forecast/generation/wind/evolution", params)
            raw_data = extract_dataset_records(resp_json)
            self.cache.set(cache_key, "EVOLUTION", params, raw_data)
        else:
            raw_data = extract_dataset_records(raw_data)
            
        versions: List[ForecastHistoryVersion] = []
        candidate_records: List[WindForecastRecord] = []
        settlement_date: Optional[str] = None
        settlement_period: Optional[int] = None
        
        for item in raw_data:
            try:
                gen = parse_generation_mw(item.get("generation"))
                if gen is None:
                    continue
                pub_time = ensure_utc(datetime.fromisoformat(item["publishTime"]))
                lead_hrs = (st_utc - pub_time).total_seconds() / 3600.0
                eligible = True if (cutoff is None or pub_time <= cutoff) else False
                
                if item.get("settlementDate"):
                    settlement_date = item["settlementDate"]
                if item.get("settlementPeriod") is not None:
                    try:
                        settlement_period = int(item["settlementPeriod"])
                    except ValueError:
                        pass
                        
                v = ForecastHistoryVersion(
                    publish_time=pub_time,
                    generation_mw=gen,
                    eligible=eligible,
                    lead_time_hours=round(lead_hrs, 2),
                    is_selected=False
                )
                versions.append(v)
                
                # Add to candidate forecast records for consistent selection
                candidate_records.append(WindForecastRecord(
                    start_time=st_utc,
                    publish_time=pub_time,
                    generation_mw=gen,
                    settlement_date=settlement_date,
                    settlement_period=settlement_period
                ))
            except Exception as e:
                logger.debug(f"Error parsing evolution row: {e}")
                
        # Sort versions chronologically
        versions.sort(key=lambda x: x.publish_time)
        
        # Consistent selection using shared algorithm
        selected_version: Optional[ForecastHistoryVersion] = None
        if candidate_records and cutoff is not None:
            chosen = select_forecast_for_interval(candidate_records, cutoff)
            if chosen is not None:
                for v in versions:
                    if v.publish_time == chosen.publish_time and math.isclose(v.generation_mw, chosen.generation_mw, rel_tol=1e-5):
                        v.is_selected = True
                        selected_version = v
                        break
        elif candidate_records and cutoff is None:
            # If no cutoff provided, pick the latest version published
            latest_rec = sorted(candidate_records, key=lambda x: (x.publish_time, x.generation_mw))[-1]
            for v in versions:
                if v.publish_time == latest_rec.publish_time and math.isclose(v.generation_mw, latest_rec.generation_mw, rel_tol=1e-5):
                    v.is_selected = True
                    selected_version = v
                    break
            
        return ForecastHistoryResponse(
            start_time=st_utc,
            settlement_date=settlement_date or st_utc.strftime("%Y-%m-%d"),
            settlement_period=settlement_period,
            decision_cutoff=cutoff,
            selected_version=selected_version,
            versions_count=len(versions),
            versions=versions
        )


_global_elexon_client: Optional[ElexonClient] = None


def get_elexon_client() -> ElexonClient:
    global _global_elexon_client
    if _global_elexon_client is None:
        _global_elexon_client = ElexonClient()
    return _global_elexon_client

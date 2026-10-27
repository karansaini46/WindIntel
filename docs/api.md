# WindIntel — REST API Specification

## Base URL
- **Production Cloud API:** `https://windintel.onrender.com`
- **Interactive Swagger Docs (Production):** [https://windintel.onrender.com/docs](https://windintel.onrender.com/docs)
- **Local Development:** `http://localhost:8000`
- **Prefix:** `/api`
- **OpenAPI Schema:** `/openapi.json`

---

## 1. System & Metadata Endpoints

### 1.1 `GET /api/health`
Checks backend service health, database connectivity, and upstream reachability.

**Response `200 OK`:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2026-10-24T10:00:00Z",
  "cache_connected": true,
  "upstream_api": "https://data.elexon.co.uk/bmrs/api/v1"
}
```

---

### 1.2 `GET /api/metadata`
Provides global system configuration, supported evaluation windows, default decision cutoff, units, and data source attributions.

**Response `200 OK`:**
```json
{
  "supported_decision_dates": {
    "start": "2026-01-01",
    "end": "2026-01-31"
  },
  "supported_delivery_dates": {
    "start": "2026-01-02",
    "end": "2026-02-01"
  },
  "timezone": "Europe/London",
  "generation_unit": "MW",
  "default_cutoff_time": "12:00:00",
  "data_source": "Elexon Insights Solution (BMRS)",
  "datasets": {
    "actuals": "FUELHH (fuelType=WIND)",
    "forecasts": "WINDFOR",
    "history": "/forecast/generation/wind/evolution"
  },
  "last_successful_retrieval": "2026-10-24T09:30:00Z"
}
```

---

## 2. Core Evaluation Endpoints

### 2.1 `GET /api/evaluation`
Evaluates day-ahead wind forecasts against metered outturn for the target delivery day corresponding to the selected decision date and decision cutoff.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `decision_date` | string (YYYY-MM-DD) | Yes | - | Day-ahead decision date (e.g. `2026-01-05`). |
| `decision_cutoff` | string (HH:MM:SS) | No | `12:00:00` | Purchasing cutoff time in `Europe/London`. |
| `delivery_date` | string (YYYY-MM-DD) | No | Next day | Delivery date to evaluate (defaults to `decision_date + 1 day`). |
| `force_refresh` | boolean | No | `false` | Bypass local cache and re-query upstream Elexon API. |

**Response `200 OK`:**
```json
{
  "decision_date": "2026-01-05",
  "decision_cutoff": "2026-01-05T12:00:00Z",
  "delivery_date": "2026-01-06",
  "timezone": "Europe/London",
  "unit": "MW",
  "data_source": "Elexon BMRS",
  "retrieval_status": "SUCCESS",
  "cached": true,
  "last_retrieved_at": "2026-10-24T09:30:00Z",
  "metrics": {
    "mae": 1726.21,
    "rmse": 2059.65,
    "bias": 1376.04,
    "mape": 29.45,
    "mape_excluded_count": 0,
    "matched_intervals": 24,
    "coverage_percent": 50.0
  },
  "coverage": {
    "expected_intervals": 48,
    "forecast_intervals_available": 24,
    "actual_intervals_available": 48,
    "matched_pairs": 24,
    "missing_forecast_count": 24,
    "missing_actual_count": 0,
    "coverage_percent": 50.0,
    "notes": "Elexon WINDFOR forecasts are published at hourly intervals (settlement periods 1, 3, 5, ... 47), while FUELHH actuals are reported half-hourly. Unpaired half-hourly periods are preserved without artificial interpolation."
  },
  "intervals": [
    {
      "start_time": "2026-01-06T00:00:00Z",
      "end_time": "2026-01-06T00:30:00Z",
      "settlement_date": "2026-01-06",
      "settlement_period": 1,
      "forecast_mw": 6500.0,
      "actual_mw": 5744.0,
      "error_mw": 756.0,
      "abs_error_mw": 756.0,
      "publish_time": "2026-01-05T11:30:00Z",
      "lead_time_hours": 12.5,
      "status": "MATCHED"
    },
    {
      "start_time": "2026-01-06T00:30:00Z",
      "end_time": "2026-01-06T01:00:00Z",
      "settlement_date": "2026-01-06",
      "settlement_period": 2,
      "forecast_mw": null,
      "actual_mw": 5600.0,
      "error_mw": null,
      "abs_error_mw": null,
      "publish_time": null,
      "lead_time_hours": null,
      "status": "MISSING_FORECAST"
    }
  ],
  "sp_summary": [
    {
      "settlement_period": 1,
      "forecast_mw": 6500.0,
      "actual_mw": 5744.0,
      "error_mw": 756.0
    }
  ],
  "warnings": []
}
```

---

### 2.2 `GET /api/forecast-history`
Returns the complete chronological publication revision history for a specified delivery interval start time.

**Query Parameters:**
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `start_time` | string (ISO-8601 UTC) | Yes | Target delivery interval start timestamp (e.g. `2026-01-06T12:00:00Z`). |
| `decision_cutoff` | string (ISO-8601 UTC) | No | Optional cutoff to flag which versions were eligible at decision time. |

**Response `200 OK`:**
```json
{
  "start_time": "2026-01-06T12:00:00Z",
  "settlement_date": "2026-01-06",
  "settlement_period": 25,
  "versions_count": 24,
  "selected_version": {
    "publish_time": "2026-01-05T11:30:00Z",
    "generation": 6500.0,
    "eligible": true,
    "lead_time_hours": 24.5
  },
  "versions": [
    {
      "publish_time": "2026-01-04T02:30:00Z",
      "generation": 6370.0,
      "eligible": true,
      "lead_time_hours": 57.5,
      "is_selected": false
    },
    {
      "publish_time": "2026-01-05T11:30:00Z",
      "generation": 6500.0,
      "eligible": true,
      "lead_time_hours": 24.5,
      "is_selected": true
    },
    {
      "publish_time": "2026-01-05T15:30:00Z",
      "generation": 6761.0,
      "eligible": false,
      "lead_time_hours": 20.5,
      "is_selected": false
    }
  ]
}
```

---

### 2.3 `GET /api/export`
Generates and downloads a standardized RFC 4180 CSV export of the evaluated intervals for the selected decision date and cutoff.

**Query Parameters:**
Identical to `GET /api/evaluation`.

**Response Headers:**
- `Content-Type: text/csv; charset=utf-8`
- `Content-Disposition: attachment; filename="windintel_evaluation_2026-01-05.csv"`

**CSV Structure:**
```csv
delivery_start_time,delivery_end_time,settlement_date,settlement_period,actual_generation_mw,forecast_generation_mw,forecast_error_mw,abs_error_mw,publish_time,lead_time_hours,status
2026-01-06T00:00:00Z,2026-01-06T00:30:00Z,2026-01-06,1,5744.0,6500.0,756.0,756.0,2026-01-05T11:30:00Z,12.5,MATCHED
2026-01-06T00:30:00Z,2026-01-06T01:00:00Z,2026-01-06,2,5600.0,,,,,,,MISSING_FORECAST
```

---

## 3. Standardized Error Responses

All API errors return RFC 7807 problem details:
```json
{
  "detail": "Date range parameter validation failed: decision_date must be within January 2026 (2026-01-01 to 2026-01-31).",
  "error_code": "INVALID_DECISION_DATE",
  "status_code": 400
}
```

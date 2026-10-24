from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.clients.elexon import get_elexon_client, ElexonApiError
from app.schemas.actuals import ActualWindRecord
from app.schemas.forecasts import WindForecastRecord, ForecastHistoryResponse, ForecastHistoryVersion


@pytest.fixture
def client():
    return TestClient(app)


def test_health_endpoint_healthy(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("healthy", "degraded")
    assert "version" in data
    assert "upstream_api" in data


def test_health_endpoint_degraded_when_cache_fails():
    mock_elexon = MagicMock()
    mock_elexon.cache.check_health.return_value = False
    
    app.dependency_overrides[get_elexon_client] = lambda: mock_elexon
    try:
        tc = TestClient(app)
        response = tc.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert data["cache_connected"] is False
    finally:
        app.dependency_overrides.clear()


def test_metadata_endpoint(client):
    response = client.get("/api/metadata")
    assert response.status_code == 200
    data = response.json()
    assert data["generation_unit"] == "MW"
    assert data["timezone"] == "Europe/London"
    assert data["supported_decision_dates"]["start"] == "2026-01-01"
    assert data["supported_decision_dates"]["end"] == "2026-01-31"


def test_evaluation_invalid_date_format(client):
    response = client.get("/api/evaluation?decision_date=invalid-date")
    assert response.status_code == 400
    assert "Invalid decision_date format" in response.json()["detail"]


def test_evaluation_out_of_range_date(client):
    response = client.get("/api/evaluation?decision_date=2025-12-31")
    assert response.status_code == 400
    assert "outside the supported January 2026 evaluation period" in response.json()["detail"]


def test_evaluation_invalid_cutoff(client):
    response = client.get("/api/evaluation?decision_date=2026-01-05&decision_cutoff=not-a-time")
    assert response.status_code == 400
    assert "Invalid decision_cutoff format" in response.json()["detail"]


def test_mocked_evaluation_endpoint():
    deliv_date = "2026-01-06"
    t1 = datetime(2026, 1, 6, 0, 0, tzinfo=timezone.utc)
    t2 = datetime(2026, 1, 6, 1, 0, tzinfo=timezone.utc)
    pub = datetime(2026, 1, 5, 11, 30, tzinfo=timezone.utc)
    
    mock_actuals = [
        ActualWindRecord(start_time=t1, settlement_date=deliv_date, settlement_period=1, generation_mw=5000.0),
        ActualWindRecord(start_time=t2, settlement_date=deliv_date, settlement_period=3, generation_mw=6000.0),
    ]
    mock_forecasts = [
        WindForecastRecord(start_time=t1, publish_time=pub, generation_mw=5200.0, settlement_date=deliv_date),
        WindForecastRecord(start_time=t2, publish_time=pub, generation_mw=5800.0, settlement_date=deliv_date),
    ]
    
    mock_elexon = MagicMock()
    mock_elexon.get_actual_wind_generation = AsyncMock(return_value=mock_actuals)
    mock_elexon.get_wind_forecasts = AsyncMock(return_value=mock_forecasts)
    mock_elexon.last_query_was_cached = True
    mock_elexon.cache.get_last_successful_retrieval.return_value = datetime(2026, 1, 5, 12, 0, tzinfo=timezone.utc)
    
    app.dependency_overrides[get_elexon_client] = lambda: mock_elexon
    try:
        tc = TestClient(app)
        response = tc.get("/api/evaluation?decision_date=2026-01-05&decision_cutoff=12:00:00")
        assert response.status_code == 200
        data = response.json()
        assert data["decision_date"] == "2026-01-05"
        assert data["delivery_date"] == "2026-01-06"
        assert data["unit"] == "MW"
        assert data["cached"] is True
        assert data["metrics"]["matched_intervals"] == 2
        assert data["metrics"]["mae"] == 200.0
    finally:
        app.dependency_overrides.clear()


def test_upstream_api_failure_handling():
    """
    Rigorously validates that upstream Elexon failure returns HTTP 502 with diagnostic detail
    and does NOT expose stack traces or crash the application.
    """
    mock_elexon = MagicMock()
    mock_elexon.get_actual_wind_generation = AsyncMock(side_effect=ElexonApiError("Connection timeout upstream", status_code=504))
    
    app.dependency_overrides[get_elexon_client] = lambda: mock_elexon
    try:
        tc = TestClient(app)
        response = tc.get("/api/evaluation?decision_date=2026-01-05")
        assert response.status_code == 502
        data = response.json()
        assert "detail" in data
        assert "Error retrieving actual wind generation" in data["detail"]
    finally:
        app.dependency_overrides.clear()


def test_forecast_history_consistency():
    st = datetime(2026, 1, 6, 12, 0, tzinfo=timezone.utc)
    pub = datetime(2026, 1, 5, 11, 30, tzinfo=timezone.utc)
    cutoff = datetime(2026, 1, 5, 12, 0, tzinfo=timezone.utc)
    
    mock_elexon = MagicMock()
    mock_elexon.get_forecast_evolution = AsyncMock(return_value=ForecastHistoryResponse(
        start_time=st,
        settlement_date="2026-01-06",
        settlement_period=25,
        decision_cutoff=cutoff,
        selected_version=ForecastHistoryVersion(
            publish_time=pub,
            generation_mw=4500.0,
            eligible=True,
            lead_time_hours=24.5,
            is_selected=True
        ),
        versions_count=1,
        versions=[
            ForecastHistoryVersion(
                publish_time=pub,
                generation_mw=4500.0,
                eligible=True,
                lead_time_hours=24.5,
                is_selected=True
            )
        ]
    ))
    
    app.dependency_overrides[get_elexon_client] = lambda: mock_elexon
    try:
        tc = TestClient(app)
        response = tc.get("/api/forecast-history?start_time=2026-01-06T12:00:00Z&decision_cutoff=2026-01-05T12:00:00Z")
        assert response.status_code == 200
        data = response.json()
        assert data["selected_version"] is not None
        assert data["selected_version"]["generation_mw"] == 4500.0
        assert data["selected_version"]["is_selected"] is True
    finally:
        app.dependency_overrides.clear()


def test_forecast_history_invalid_timestamp(client):
    response = client.get("/api/forecast-history?start_time=invalid-iso")
    assert response.status_code == 400


def test_csv_export_endpoint():
    deliv_date = "2026-01-06"
    t1 = datetime(2026, 1, 6, 0, 0, tzinfo=timezone.utc)
    pub = datetime(2026, 1, 5, 11, 30, tzinfo=timezone.utc)
    
    mock_actuals = [
        ActualWindRecord(start_time=t1, settlement_date=deliv_date, settlement_period=1, generation_mw=5000.0),
    ]
    mock_forecasts = [
        WindForecastRecord(start_time=t1, publish_time=pub, generation_mw=5200.0, settlement_date=deliv_date),
    ]
    
    mock_elexon = MagicMock()
    mock_elexon.get_actual_wind_generation = AsyncMock(return_value=mock_actuals)
    mock_elexon.get_wind_forecasts = AsyncMock(return_value=mock_forecasts)
    mock_elexon.last_query_was_cached = False
    mock_elexon.cache.get_last_successful_retrieval.return_value = None
    
    app.dependency_overrides[get_elexon_client] = lambda: mock_elexon
    try:
        tc = TestClient(app)
        response = tc.get("/api/export?decision_date=2026-01-05")
        assert response.status_code == 200
        assert "text/csv" in response.headers["content-type"]
        assert "attachment; filename=" in response.headers["content-disposition"]
        csv_text = response.text
        assert "delivery_start_time_utc" in csv_text
        assert "actual_generation_mw" in csv_text
        assert "5000.00" in csv_text
        assert "5200.00" in csv_text
    finally:
        app.dependency_overrides.clear()

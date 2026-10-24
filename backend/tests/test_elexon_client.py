from datetime import datetime, timezone, timedelta
import pytest
from app.clients.elexon import (
    parse_generation_mw,
    extract_dataset_records,
    ElexonClient,
    ElexonApiError
)
from app.db.cache import SQLiteCache


def test_parse_generation_numeric_and_zeros():
    # Legitimate zero generation must be preserved as 0.0
    assert parse_generation_mw(0) == 0.0
    assert parse_generation_mw(0.0) == 0.0
    assert parse_generation_mw("0") == 0.0
    assert parse_generation_mw("0.0") == 0.0
    
    # Valid positive numbers
    assert parse_generation_mw(1234.5) == 1234.5
    assert parse_generation_mw("4500") == 4500.0
    
    # Negative values must be preserved, NOT clamped to zero
    assert parse_generation_mw(-12.5) == -12.5
    assert parse_generation_mw("-5") == -5.0


def test_parse_generation_missing_and_invalid():
    # Missing / None
    assert parse_generation_mw(None) is None
    assert parse_generation_mw("") is None
    assert parse_generation_mw("   ") is None
    assert parse_generation_mw("null") is None
    assert parse_generation_mw("NaN") is None
    assert parse_generation_mw("none") is None
    assert parse_generation_mw("missing") is None
    
    # Unparseable strings
    assert parse_generation_mw("invalid_string") is None
    assert parse_generation_mw({"a": 1}) is None
    assert parse_generation_mw([1, 2]) is None
    
    # Float NaN and Infinity
    assert parse_generation_mw(float("nan")) is None
    assert parse_generation_mw(float("inf")) is None
    assert parse_generation_mw(float("-inf")) is None


def test_extract_dataset_records_formats():
    # Direct list response
    list_resp = [{"id": 1}, {"id": 2}]
    assert extract_dataset_records(list_resp) == list_resp
    
    # Dict with 'data' field
    data_dict = {"data": [{"id": 3}]}
    assert extract_dataset_records(data_dict) == [{"id": 3}]
    
    # Dict with 'items' field
    items_dict = {"items": [{"id": 4}]}
    assert extract_dataset_records(items_dict) == [{"id": 4}]
    
    # Empty or unrecognized structure
    assert extract_dataset_records({}) == []
    assert extract_dataset_records(None) == []
    assert extract_dataset_records("string") == []


def test_cache_health_and_last_retrieval(tmp_path):
    db_file = str(tmp_path / "test_cache.db")
    cache = SQLiteCache(db_file)
    
    # Cache should be healthy
    assert cache.check_health() is True
    
    # Initially no successful retrievals recorded
    assert cache.get_last_successful_retrieval() is None
    
    # Write a test cache item
    cache.set("TEST:KEY", "FUELHH", {"date": "2026-01-05"}, [{"generation": 100}])
    
    # Now last retrieval should be a valid datetime
    last_ts = cache.get_last_successful_retrieval()
    assert last_ts is not None
    assert isinstance(last_ts, datetime)
    assert last_ts.tzinfo is not None

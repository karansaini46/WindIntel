from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "WindIntel"
    ENV: str = "development"
    DEBUG: bool = False
    
    # Upstream Elexon Insights API
    ELEXON_API_BASE_URL: str = "https://data.elexon.co.uk/bmrs/api/v1"
    REQUEST_TIMEOUT_SECONDS: float = 25.0
    MAX_RETRIES: int = 3
    RETRY_BACKOFF_FACTOR: float = 0.5
    
    # Decision Model Configurations
    DEFAULT_DECISION_CUTOFF: str = "12:00:00"  # Operational day-ahead purchasing cutoff in local time
    MARKET_TIMEZONE: str = "Europe/London"
    GENERATION_UNIT: str = "MW"
    
    # Supported Decision Date Scope (January 2026)
    DATA_START_DATE: str = "2026-01-01"
    DATA_END_DATE: str = "2026-01-31"
    
    # Caching
    CACHE_DB_PATH: str = "windintel.db"
    CACHE_TTL_SECONDS: int = 86400 * 30  # 30 days default for immutable historical records
    
    # Security / Networking
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ]
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()

import json
import os
import sqlite3
import threading
from datetime import datetime, timezone, timedelta
from typing import Any, Optional
from app.core.logging import logger


class SQLiteCache:
    """
    Lightweight, durable SQLite cache for Elexon BMRS API responses.
    Ensures historical responses are preserved locally, avoiding repeated
    slow network trips and shielding against upstream rate limits or outages.
    """
    def __init__(self, db_path: str = "windintel.db"):
        self.db_path = db_path
        parent_dir = os.path.dirname(self.db_path)
        if parent_dir:
            os.makedirs(parent_dir, exist_ok=True)
        self._lock = threading.Lock()
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=15.0)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._lock:
            with self._get_connection() as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS api_cache (
                        cache_key TEXT PRIMARY KEY,
                        dataset TEXT NOT NULL,
                        params_json TEXT NOT NULL,
                        response_json TEXT NOT NULL,
                        created_at TEXT NOT NULL,
                        expires_at TEXT NOT NULL
                    )
                """)
                conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_api_cache_dataset ON api_cache(dataset)
                """)
                conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON api_cache(expires_at)
                """)
                conn.commit()

    def get(self, cache_key: str) -> Optional[Any]:
        now_iso = datetime.now(timezone.utc).isoformat()
        try:
            with self._lock:
                with self._get_connection() as conn:
                    cur = conn.execute(
                        "SELECT response_json FROM api_cache WHERE cache_key = ? AND expires_at > ?",
                        (cache_key, now_iso)
                    )
                    row = cur.fetchone()
                    if row:
                        return json.loads(row["response_json"])
        except Exception as e:
            logger.warning(f"Cache read error for key {cache_key}: {e}")
        return None

    def set(
        self,
        cache_key: str,
        dataset: str,
        params: dict,
        data: Any,
        ttl_seconds: int = 86400 * 30
    ) -> None:
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(seconds=ttl_seconds)
        try:
            params_str = json.dumps(params, sort_keys=True)
            response_str = json.dumps(data)
            with self._lock:
                with self._get_connection() as conn:
                    conn.execute("""
                        INSERT OR REPLACE INTO api_cache 
                        (cache_key, dataset, params_json, response_json, created_at, expires_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (
                        cache_key,
                        dataset,
                        params_str,
                        response_str,
                        now.isoformat(),
                        expires_at.isoformat()
                    ))
                    conn.commit()
        except Exception as e:
            logger.warning(f"Cache write error for key {cache_key}: {e}")

    def check_health(self) -> bool:
        """Verifies database connectivity and queryability."""
        try:
            with self._lock:
                with self._get_connection() as conn:
                    conn.execute("SELECT 1 FROM api_cache LIMIT 1")
                    return True
        except Exception as e:
            logger.error(f"Cache health check failed: {e}")
            return False

    def get_last_successful_retrieval(self) -> Optional[datetime]:
        """
        Returns the recorded timestamp of the most recent successful
        upstream API retrieval saved in cache, or None if no records exist.
        """
        try:
            with self._lock:
                with self._get_connection() as conn:
                    cur = conn.execute("SELECT MAX(created_at) AS last_ts FROM api_cache")
                    row = cur.fetchone()
                    if row and row["last_ts"]:
                        ts_str = row["last_ts"]
                        dt = datetime.fromisoformat(ts_str)
                        if dt.tzinfo is None:
                            return dt.replace(tzinfo=timezone.utc)
                        return dt.astimezone(timezone.utc)
        except Exception as e:
            logger.warning(f"Error reading last successful retrieval from cache: {e}")
        return None

    def clear(self) -> None:
        with self._lock:
            with self._get_connection() as conn:
                conn.execute("DELETE FROM api_cache")
                conn.commit()


_global_cache: Optional[SQLiteCache] = None


def get_cache(db_path: str = "windintel.db") -> SQLiteCache:
    global _global_cache
    if _global_cache is None:
        _global_cache = SQLiteCache(db_path)
    return _global_cache

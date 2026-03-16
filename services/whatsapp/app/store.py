import logging
import os

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    psycopg2 = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)

DATABASE_URL: str | None = os.environ.get("DATABASE_URL")

_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS whatsapp_monitor_state (
    id          INTEGER PRIMARY KEY DEFAULT 1,
    phones      JSONB   NOT NULL DEFAULT '[]',
    group_jids  JSONB   NOT NULL DEFAULT '[]',
    callback_url TEXT   NOT NULL DEFAULT ''
)
"""

_UPSERT = """
INSERT INTO whatsapp_monitor_state (id, phones, group_jids, callback_url)
VALUES (1, %s, %s, %s)
ON CONFLICT (id) DO UPDATE SET
    phones       = EXCLUDED.phones,
    group_jids   = EXCLUDED.group_jids,
    callback_url = EXCLUDED.callback_url
"""

_SELECT = """
SELECT phones, group_jids, callback_url
FROM whatsapp_monitor_state
WHERE id = 1
"""


def _connect():
    return psycopg2.connect(DATABASE_URL)


def save_registration(phones: list[str], group_jids: list[str], callback_url: str) -> None:
    if not DATABASE_URL or psycopg2 is None:
        return
    try:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(_CREATE_TABLE)
                cur.execute(_UPSERT, (
                    psycopg2.extras.Json(phones),
                    psycopg2.extras.Json(group_jids),
                    callback_url,
                ))
    except Exception as e:
        logger.warning("Failed to save monitor registration: %s", e)


def load_registration() -> dict | None:
    if not DATABASE_URL or psycopg2 is None:
        return None
    try:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(_CREATE_TABLE)
                cur.execute(_SELECT)
                row = cur.fetchone()
        if row is None:
            return None
        phones, group_jids, callback_url = row
        return {"phones": phones, "group_jids": group_jids, "callback_url": callback_url}
    except Exception as e:
        logger.warning("Failed to load monitor registration: %s", e)
        return None

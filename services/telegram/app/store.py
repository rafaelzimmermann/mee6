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
CREATE TABLE IF NOT EXISTS telegram_monitor_state (
    id           INTEGER PRIMARY KEY DEFAULT 1,
    bot_token    TEXT    NOT NULL DEFAULT '',
    user_ids     JSONB   NOT NULL DEFAULT '[]',
    chat_ids     JSONB   NOT NULL DEFAULT '[]',
    callback_url TEXT    NOT NULL DEFAULT ''
)
"""

_UPSERT = """
INSERT INTO telegram_monitor_state (id, bot_token, user_ids, chat_ids, callback_url)
VALUES (1, %s, %s, %s, %s)
ON CONFLICT (id) DO UPDATE SET
    bot_token    = EXCLUDED.bot_token,
    user_ids     = EXCLUDED.user_ids,
    chat_ids     = EXCLUDED.chat_ids,
    callback_url = EXCLUDED.callback_url
"""

_SELECT = """
SELECT bot_token, user_ids, chat_ids, callback_url
FROM telegram_monitor_state
WHERE id = 1
"""

_UPDATE_REGISTRATION = """
INSERT INTO telegram_monitor_state (id, bot_token, user_ids, chat_ids, callback_url)
VALUES (1, '', %s, %s, %s)
ON CONFLICT (id) DO UPDATE SET
    user_ids     = EXCLUDED.user_ids,
    chat_ids     = EXCLUDED.chat_ids,
    callback_url = EXCLUDED.callback_url
"""

_UPDATE_TOKEN = """
INSERT INTO telegram_monitor_state (id, bot_token, user_ids, chat_ids, callback_url)
VALUES (1, %s, '[]', '[]', '')
ON CONFLICT (id) DO UPDATE SET
    bot_token = EXCLUDED.bot_token
"""


_CREATE_CONTACTS_TABLE = """
CREATE TABLE IF NOT EXISTS telegram_contacts (
    contact_id   TEXT PRIMARY KEY,
    type         TEXT NOT NULL,
    name         TEXT NOT NULL,
    username     TEXT,
    last_seen_at TIMESTAMP DEFAULT NOW()
)
"""

_UPSERT_CONTACT = """
INSERT INTO telegram_contacts (contact_id, type, name, username, last_seen_at)
VALUES (%s, %s, %s, %s, NOW())
ON CONFLICT (contact_id) DO UPDATE SET
    name         = EXCLUDED.name,
    username     = EXCLUDED.username,
    last_seen_at = NOW()
"""

_SELECT_CONTACTS = """
SELECT contact_id, type, name, username, last_seen_at
FROM telegram_contacts
ORDER BY last_seen_at DESC
"""


def _connect():
    return psycopg2.connect(DATABASE_URL)


def save_registration(user_ids: list[str], chat_ids: list[str], callback_url: str) -> None:
    if not DATABASE_URL or psycopg2 is None:
        return
    try:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(_CREATE_TABLE)
                cur.execute(_UPDATE_REGISTRATION, (
                    psycopg2.extras.Json(user_ids),
                    psycopg2.extras.Json(chat_ids),
                    callback_url,
                ))
    except Exception as e:
        logger.warning("Failed to save monitor registration: %s", e)


def save_token(bot_token: str) -> None:
    if not DATABASE_URL or psycopg2 is None:
        return
    try:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(_CREATE_TABLE)
                cur.execute(_UPDATE_TOKEN, (bot_token,))
    except Exception as e:
        logger.warning("Failed to save bot token: %s", e)


def save_contact(contact_id: str, contact_type: str, name: str, username: str | None) -> None:
    if not DATABASE_URL or psycopg2 is None:
        return
    try:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(_CREATE_CONTACTS_TABLE)
                cur.execute(_UPSERT_CONTACT, (contact_id, contact_type, name, username))
    except Exception as e:
        logger.warning("Failed to save contact: %s", e)


def load_contacts() -> list[dict]:
    if not DATABASE_URL or psycopg2 is None:
        return []
    try:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(_CREATE_CONTACTS_TABLE)
                cur.execute(_SELECT_CONTACTS)
                rows = cur.fetchall()
        return [
            {"contact_id": r[0], "type": r[1], "name": r[2], "username": r[3]}
            for r in rows
        ]
    except Exception as e:
        logger.warning("Failed to load contacts: %s", e)
        return []


def load_state() -> dict | None:
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
        bot_token, user_ids, chat_ids, callback_url = row
        return {
            "bot_token": bot_token,
            "user_ids": user_ids,
            "chat_ids": chat_ids,
            "callback_url": callback_url,
        }
    except Exception as e:
        logger.warning("Failed to load state: %s", e)
        return None

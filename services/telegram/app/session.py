import asyncio
import enum
import logging
from dataclasses import dataclass, field
from typing import Optional

import httpx

from app.config import WEBHOOK_SECRET

logger = logging.getLogger(__name__)


class TGStatus(str, enum.Enum):
    disconnected = "disconnected"
    connecting = "connecting"
    connected = "connected"
    error = "error"


@dataclass
class MonitorRegistration:
    callback_url: str
    user_ids: list[str] = field(default_factory=list)
    chat_ids: list[str] = field(default_factory=list)


class TelegramSession:
    def __init__(self):
        self.status: TGStatus = TGStatus.disconnected
        self.registration: Optional[MonitorRegistration] = None
        self._application = None
        self._bot_info = None

    async def connect(self, bot_token: str) -> None:
        if self.status in (TGStatus.connecting, TGStatus.connected):
            await self.disconnect()

        self.status = TGStatus.connecting
        try:
            from telegram.ext import Application, CommandHandler, MessageHandler, filters

            app = (
                Application.builder()
                .token(bot_token)
                .build()
            )
            app.add_handler(CommandHandler("start", self._on_start))
            app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self._on_message))

            await app.initialize()
            await app.start()
            await app.updater.start_polling(drop_pending_updates=True)

            self._application = app
            self._bot_info = await app.bot.get_me()
            self.status = TGStatus.connected
            logger.info("Telegram bot connected as @%s", self._bot_info.username)
        except Exception as e:
            self.status = TGStatus.error
            logger.error("Failed to connect Telegram bot: %s", e)
            raise

    async def disconnect(self) -> None:
        if self._application:
            try:
                await self._application.updater.stop()
                await self._application.stop()
                await self._application.shutdown()
            except Exception as e:
                logger.warning("Error during disconnect: %s", e)
            self._application = None
            self._bot_info = None
        self.status = TGStatus.disconnected
        logger.info("Telegram bot disconnected")

    def register_monitor(
        self, callback_url: str, user_ids: list[str], chat_ids: list[str]
    ) -> None:
        from app import store
        self.registration = MonitorRegistration(
            callback_url=callback_url,
            user_ids=user_ids,
            chat_ids=chat_ids,
        )
        store.save_registration(user_ids=user_ids, chat_ids=chat_ids, callback_url=callback_url)
        logger.info(
            "Monitor registered — users: %s, chats: %s",
            user_ids or "(all)",
            chat_ids or "(all)",
        )

    async def send_message(self, to: str, text: str) -> None:
        if not self._application or self.status != TGStatus.connected:
            raise RuntimeError("Telegram bot not connected")
        await self._application.bot.send_message(chat_id=int(to), text=text)

    def get_bot_info(self) -> dict:
        if self._bot_info:
            return {
                "id": self._bot_info.id,
                "username": self._bot_info.username,
                "first_name": self._bot_info.first_name,
            }
        return {}

    # --- Telegram update handlers ---

    async def _on_start(self, update, context) -> None:
        user = update.effective_user
        if not user:
            return
        _record_contact_from_update(update)
        await update.message.reply_text(
            f"Your Telegram User ID is: {user.id}\n\n"
            "Share this with your mee6 admin to set up message triggers."
        )

    async def _on_message(self, update, context) -> None:
        if self.registration is None:
            logger.info("Message received but no monitor registration — ignoring")
            return

        msg = update.effective_message
        chat = update.effective_chat
        user = update.effective_user

        if not msg or not msg.text:
            return

        _record_contact_from_update(update)

        text = msg.text
        sender_id = str(user.id) if user else None
        chat_id = str(chat.id)
        is_private = chat.type == "private"

        if is_private:
            if self.registration.user_ids and sender_id not in self.registration.user_ids:
                logger.info(
                    "User %s not in monitored list %s — ignoring",
                    sender_id,
                    self.registration.user_ids,
                )
                return
            payload = {"type": "telegram_dm", "sender": sender_id, "text": text}
        else:
            if self.registration.chat_ids and chat_id not in self.registration.chat_ids:
                logger.info(
                    "Chat %s not in monitored list %s — ignoring",
                    chat_id,
                    self.registration.chat_ids,
                )
                return
            payload = {
                "type": "telegram_chat",
                "sender": sender_id,
                "chat_id": chat_id,
                "text": text,
            }

        logger.info("Dispatching Telegram callback: %s", payload)
        await _post_callback(self.registration.callback_url, payload)


def _record_contact_from_update(update) -> None:
    from app import store
    user = update.effective_user
    chat = update.effective_chat
    if not chat:
        return
    if chat.type == "private" and user:
        name = " ".join(filter(None, [user.first_name, user.last_name])) or str(user.id)
        store.save_contact(str(user.id), "user", name, user.username)
    else:
        store.save_contact(str(chat.id), "chat", chat.title or str(chat.id), getattr(chat, "username", None))


async def _post_callback(url: str, payload: dict) -> None:
    headers = {"X-Webhook-Secret": WEBHOOK_SECRET, "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            r = await client.post(url, json=payload, headers=headers)
            if r.status_code >= 400:
                raise httpx.HTTPStatusError(
                    "callback failed", request=r.request, response=r
                )
        except Exception as e:
            logger.warning("Callback failed (%s), retrying once: %s", url, e)
            try:
                async with httpx.AsyncClient(timeout=10) as retry_client:
                    await retry_client.post(url, json=payload, headers=headers)
            except Exception as e2:
                logger.error("Callback retry failed: %s", e2)


session = TelegramSession()

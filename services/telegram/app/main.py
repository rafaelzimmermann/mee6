import logging

from fastapi import FastAPI

from app.router import router
from app.session import session

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(name)s: %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="mee6-telegram")
app.include_router(router)


@app.on_event("startup")
async def startup():
    from app import store

    state = store.load_state()
    if not state:
        logger.info("No saved Telegram state — waiting for configuration")
        return

    if state.get("callback_url"):
        session.register_monitor(
            callback_url=state["callback_url"],
            user_ids=state["user_ids"],
            chat_ids=state["chat_ids"],
        )
        logger.info("Monitor registration restored from database")

    if state.get("bot_token"):
        logger.info("Saved bot token found — auto-connecting")
        try:
            await session.connect(state["bot_token"])
        except Exception as e:
            logger.error("Auto-connect failed: %s", e)
    else:
        logger.info("No bot token saved — manual connect required")


@app.on_event("shutdown")
async def shutdown():
    await session.disconnect()

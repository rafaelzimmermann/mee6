import logging

from fastapi import FastAPI
from app.router import router
from app.session import session

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(name)s: %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="mee6-whatsapp")
app.include_router(router)


@app.on_event("startup")
async def startup():
    import os
    from app import store
    from app.config import STORAGE_PATH

    state = store.load_registration()
    if state:
        session.register_monitor(**state)
        logger.info("Monitor registration restored from database")
    else:
        logger.info("No saved monitor registration found — waiting for Rails to register")

    if os.path.exists(f"{STORAGE_PATH}/session"):
        logger.info("Existing session found — auto-connecting")
        await session.connect()
    else:
        logger.info("No session file found — manual connect required")

from fastapi import FastAPI
from app.router import router

app = FastAPI(title="mee6 Agent Service")
app.include_router(router)

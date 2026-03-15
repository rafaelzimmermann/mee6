from fastapi import FastAPI
from app.router import router

app = FastAPI(title="mee6-whatsapp")
app.include_router(router)


@app.on_event("startup")
async def startup():
    pass

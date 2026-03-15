from fastapi import FastAPI
from fastapi.responses import JSONResponse
from app.router import router

app = FastAPI(title="WhatsApp Service", version="0.1.0")
app.include_router(router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8002)

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.health import router as health_router
from app.api.routes.reports import router as reports_router
from app.core.config import settings
from app.core.errors import APIError, api_error_handler, validation_error_handler

app = FastAPI(
    title="LaporPak API",
    description="Backend API for LaporPak",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(reports_router)
app.add_exception_handler(APIError, api_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)


@app.get("/")
def root():
    return {
        "name": "LaporPak API",
        "version": "0.1.0",
    }

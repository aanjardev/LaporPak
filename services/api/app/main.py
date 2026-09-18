from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.citizen import router as citizen_router
from app.api.routes.health import router as health_router
from app.api.routes.knowledge import router as knowledge_router
from app.api.routes.knowledge import tools_router as knowledge_tools_router
from app.api.routes.reports import router as reports_router
from app.api.routes.service_requests import router as service_requests_router
from app.core.config import settings
from app.core.errors import register_error_handlers

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

register_error_handlers(app)

app.include_router(health_router)
app.include_router(reports_router)
app.include_router(citizen_router)
app.include_router(service_requests_router)
app.include_router(knowledge_router)
app.include_router(knowledge_tools_router)


@app.get("/")
def root():
    return {
        "name": "LaporPak API",
        "version": "0.1.0",
    }

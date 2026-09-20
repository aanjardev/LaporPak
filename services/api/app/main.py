import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.admin import router as admin_router
from app.api.routes.citizen import router as citizen_router
from app.api.routes.enhanced import router as enhanced_router
from app.api.routes.health import router as health_router
from app.api.routes.knowledge import router as knowledge_router
from app.api.routes.knowledge import tools_router as knowledge_tools_router
from app.api.routes.report_documents import router as report_documents_router
from app.api.routes.reports import router as reports_router
from app.api.routes.service_requests import router as service_requests_router
from app.api.routes.villages import router as villages_router
from app.api.routes.whatsapp_setup import router as whatsapp_setup_router
from app.core.config import settings
from app.core.errors import register_error_handlers
from app.services.report_documents import document_worker_loop


@asynccontextmanager
async def lifespan(_app: FastAPI):
    worker = asyncio.create_task(document_worker_loop())
    try:
        yield
    finally:
        worker.cancel()
        try:
            await worker
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="LaporPak API",
    description="Backend API for LaporPak",
    version="0.1.0",
    lifespan=lifespan,
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
app.include_router(report_documents_router)
app.include_router(citizen_router)
app.include_router(enhanced_router)
app.include_router(service_requests_router)
app.include_router(knowledge_router)
app.include_router(knowledge_tools_router)
app.include_router(villages_router)
app.include_router(admin_router)
app.include_router(whatsapp_setup_router)


@app.get("/")
def root():
    return {
        "name": "LaporPak API",
        "version": "0.1.0",
    }

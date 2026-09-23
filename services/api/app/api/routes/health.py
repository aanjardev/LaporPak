from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.db.session import get_engine
from app.services.openclaw_gateway import OpenClawGateway, OpenClawGatewayError

router = APIRouter(tags=["Health"])


@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "laporpak-api",
    }


@router.get("/ready")
def readiness_check():
    configuration_ok = bool(
        settings.database_url
        and settings.supabase_url
        and (settings.supabase_publishable_key or settings.supabase_anon_key)
        and (settings.supabase_secret_key or settings.supabase_service_role_key)
        and settings.openclaw_api_key
        and settings.openclaw_api_key.get_secret_value()
    )
    database_ok = False
    try:
        with get_engine().connect() as connection:
            connection.execute(text("SET LOCAL statement_timeout = '3000ms'"))
            database_ok = connection.execute(text("SELECT 1")).scalar_one() == 1
    except SQLAlchemyError, OSError:
        pass
    gateway_ok = False
    try:
        OpenClawGateway().health()
        gateway_ok = True
    except OpenClawGatewayError:
        pass
    core_ok = configuration_ok and database_ok
    return JSONResponse(
        status_code=200 if core_ok else 503,
        headers={"Cache-Control": "no-store"},
        content={
            "status": "ok"
            if core_ok and gateway_ok
            else "degraded"
            if core_ok
            else "unavailable",
            "components": {
                "configuration": "ok" if configuration_ok else "unavailable",
                "database": "ok" if database_ok else "unavailable",
                "openclaw": "ok" if gateway_ok else "degraded",
            },
        },
    )

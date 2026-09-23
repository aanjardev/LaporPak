import logging

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import settings
from app.middleware import RequestTimingMiddleware


def test_request_timing_log_contains_safe_route_and_no_headers(monkeypatch, caplog):
    monkeypatch.setattr(settings, "app_env", "development")
    app = FastAPI()
    app.add_middleware(RequestTimingMiddleware)

    @app.get("/reports/{report_id}")
    def report(report_id: str):
        return {"ok": True}

    with caplog.at_level(logging.INFO, logger="laporpak.request_timing"):
        response = TestClient(app).get(
            "/reports/12345678-1234-1234-1234-123456789012",
            headers={"Authorization": "Bearer secret-token"},
        )

    assert response.status_code == 200
    message = next(record.message for record in caplog.records if record.name == "laporpak.request_timing")
    assert "route=/reports/{report_id}" in message or "route=/reports/:id" in message
    assert "secret-token" not in message
    assert "duration_ms=" in message

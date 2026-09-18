from typing import Annotated
from uuid import UUID

import httpx
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel, SecretStr

from app.core.config import settings
from app.core.errors import APIError, register_error_handlers
from app.core.security import (
    AdminCaller,
    AuthenticatedCaller,
    OpenClawCaller,
    require_admin,
)


class ExampleBody(BaseModel):
    count: int


def build_test_app() -> FastAPI:
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/openclaw")
    def openclaw_only(caller: OpenClawCaller):
        return caller

    @app.get("/admin")
    def admin_only(caller: AdminCaller):
        return caller

    @app.get("/admin-explicit")
    def admin_explicit(
        caller: Annotated[AuthenticatedCaller, Depends(require_admin)],
    ):
        return caller

    @app.post("/validation")
    def validate_body(body: ExampleBody):
        return body

    @app.get("/controlled-error")
    def controlled_error():
        raise APIError(
            status_code=409,
            code="DUPLICATE_OPERATION",
            message="Operation already exists",
        )

    @app.get("/unexpected-error")
    def unexpected_error():
        raise RuntimeError("internal-secret-value")

    return app


def configure_tokens(monkeypatch):
    monkeypatch.setattr(settings, "allow_legacy_admin_fallback", True)
    monkeypatch.setattr(settings, "openclaw_api_key", SecretStr("openclaw-token"))
    monkeypatch.setattr(settings, "supabase_url", "https://project.supabase.co")
    monkeypatch.setattr(settings, "supabase_anon_key", "anon-key")
    monkeypatch.setattr(
        settings,
        "dashboard_admin_unit_id",
        UUID("00000000-0000-4000-8000-000000000002"),
    )

    def fake_get(_url, *, headers, timeout):
        assert headers["apikey"] == "anon-key"
        assert timeout == 5
        if headers["Authorization"] == "Bearer admin-token":
            return httpx.Response(
                200,
                json={"id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"},
            )
        return httpx.Response(401, json={"message": "invalid token"})

    monkeypatch.setattr("app.core.security.httpx.get", fake_get)


def test_missing_or_invalid_token_uses_standard_error(monkeypatch):
    configure_tokens(monkeypatch)
    client = TestClient(build_test_app())

    missing = client.get("/openclaw")
    invalid = client.get(
        "/openclaw",
        headers={"X-OpenClaw-API-Key": "wrong-token"},
    )

    assert missing.status_code == 401
    assert missing.json() == {
        "error": {
            "code": "UNAUTHORIZED",
            "message": "Valid OpenClaw API key required",
            "details": None,
        }
    }
    assert invalid.json() == missing.json()


def test_openclaw_and_admin_tokens_have_separate_permissions(monkeypatch):
    configure_tokens(monkeypatch)
    client = TestClient(build_test_app())

    openclaw = client.get(
        "/openclaw",
        headers={"X-OpenClaw-API-Key": "openclaw-token"},
    )
    openclaw_as_admin = client.get(
        "/admin",
        headers={"Authorization": "Bearer openclaw-token"},
    )
    admin = client.get(
        "/admin-explicit",
        headers={"Authorization": "Bearer admin-token"},
    )
    admin_as_openclaw = client.get(
        "/openclaw",
        headers={"X-OpenClaw-API-Key": "admin-token"},
    )

    assert openclaw.status_code == 200
    assert openclaw.json()["caller_type"] == "openclaw"
    assert openclaw_as_admin.status_code == 401
    assert openclaw_as_admin.json()["error"]["code"] == "UNAUTHORIZED"
    assert admin.status_code == 200
    assert admin.json()["identifier"] == (
        "supabase:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    )
    assert admin.json()["administrative_unit_id"] == (
        "00000000-0000-4000-8000-000000000002"
    )
    assert admin_as_openclaw.status_code == 401


def test_invalid_supabase_token_is_rejected(monkeypatch):
    configure_tokens(monkeypatch)
    client = TestClient(build_test_app())

    response = client.get(
        "/admin",
        headers={"Authorization": "Bearer invalid-token"},
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_unconfigured_supabase_auth_fails_closed(monkeypatch):
    monkeypatch.setattr(settings, "supabase_url", "")
    monkeypatch.setattr(settings, "supabase_anon_key", "")
    client = TestClient(build_test_app())

    response = client.get(
        "/admin",
        headers={"Authorization": "Bearer any-value"},
    )

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "INTERNAL_ERROR"


def test_request_validation_uses_standard_error(monkeypatch):
    configure_tokens(monkeypatch)
    client = TestClient(build_test_app())

    response = client.post("/validation", json={"count": "not-an-integer"})

    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert body["error"]["details"][0]["location"] == ["body", "count"]


def test_controlled_and_unexpected_errors_do_not_leak_details(monkeypatch):
    configure_tokens(monkeypatch)
    client = TestClient(build_test_app(), raise_server_exceptions=False)

    controlled = client.get("/controlled-error")
    unexpected = client.get("/unexpected-error")

    assert controlled.status_code == 409
    assert controlled.json()["error"]["code"] == "DUPLICATE_OPERATION"
    assert unexpected.status_code == 500
    assert unexpected.json() == {
        "error": {
            "code": "INTERNAL_ERROR",
            "message": "An internal error occurred",
            "details": None,
        }
    }
    assert "internal-secret-value" not in unexpected.text

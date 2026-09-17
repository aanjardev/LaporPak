from typing import Annotated
from uuid import UUID

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
    monkeypatch.setattr(settings, "openclaw_api_key", SecretStr("openclaw-token"))
    monkeypatch.setattr(settings, "dashboard_api_key", SecretStr("admin-token"))
    monkeypatch.setattr(settings, "dashboard_admin_identifier", "admin-desa-demo")
    monkeypatch.setattr(
        settings,
        "dashboard_admin_unit_id",
        UUID("00000000-0000-4000-8000-000000000002"),
    )


def test_missing_or_invalid_token_uses_standard_error(monkeypatch):
    configure_tokens(monkeypatch)
    client = TestClient(build_test_app())

    missing = client.get("/openclaw")
    invalid = client.get(
        "/openclaw",
        headers={"Authorization": "Bearer wrong-token"},
    )

    assert missing.status_code == 401
    assert missing.json() == {
        "error": {
            "code": "UNAUTHORIZED",
            "message": "Valid bearer token required",
            "details": None,
        }
    }
    assert invalid.json() == missing.json()


def test_openclaw_and_admin_tokens_have_separate_permissions(monkeypatch):
    configure_tokens(monkeypatch)
    client = TestClient(build_test_app())

    openclaw = client.get(
        "/openclaw",
        headers={"Authorization": "Bearer openclaw-token"},
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
        headers={"Authorization": "Bearer admin-token"},
    )

    assert openclaw.status_code == 200
    assert openclaw.json()["caller_type"] == "openclaw"
    assert openclaw_as_admin.status_code == 403
    assert openclaw_as_admin.json()["error"]["code"] == "FORBIDDEN"
    assert admin.status_code == 200
    assert admin.json()["identifier"] == "admin-desa-demo"
    assert admin.json()["administrative_unit_id"] == (
        "00000000-0000-4000-8000-000000000002"
    )
    assert admin_as_openclaw.status_code == 403


def test_same_token_for_both_callers_is_rejected(monkeypatch):
    monkeypatch.setattr(settings, "openclaw_api_key", SecretStr("same-token"))
    monkeypatch.setattr(settings, "dashboard_api_key", SecretStr("same-token"))
    client = TestClient(build_test_app())

    response = client.get(
        "/admin",
        headers={"Authorization": "Bearer same-token"},
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


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

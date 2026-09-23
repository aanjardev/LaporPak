from unittest.mock import Mock
from uuid import uuid4

import httpx
import pytest
from fastapi import BackgroundTasks
from pydantic import SecretStr

from app.api.routes import whatsapp_setup
from app.core.config import settings
from app.core.errors import APIError
from app.services.openclaw_gateway import OpenClawGateway, OpenClawGatewayError


@pytest.fixture
def remote(monkeypatch):
    monkeypatch.setattr(settings, "openclaw_api_url", "https://gateway.example")
    monkeypatch.setattr(settings, "openclaw_gateway_token", SecretStr("gateway-test"))
    monkeypatch.setattr(settings, "cf_access_client_id", "access-test")
    monkeypatch.setattr(settings, "cf_access_client_secret", SecretStr("access-secret"))
    return OpenClawGateway()


def test_remote_requests_use_separate_auth_and_exact_account(remote, monkeypatch):
    calls = []

    def post(url, **kwargs):
        calls.append((url, kwargs))
        return httpx.Response(
            200, json={"ok": True, "payload": {}}, request=httpx.Request("POST", url)
        )

    monkeypatch.setattr(httpx, "post", post)
    remote.start_channel("village-a")
    remote.stop_channel("village-b")
    remote.logout("village-a")
    assert calls[0][1]["json"]["params"]["accountId"] == "village-a"
    assert calls[1][1]["json"]["params"]["accountId"] == "village-b"
    assert calls[0][1]["headers"]["Authorization"] == "Bearer gateway-test"
    assert calls[0][1]["headers"]["CF-Access-Client-Secret"] == "access-secret"
    assert calls[0][1]["follow_redirects"] is False
    with pytest.raises(OpenClawGatewayError):
        remote._run("gateway", "restart")


@pytest.mark.parametrize(
    "status,body",
    [
        (302, {}),
        (401, {}),
        (503, {}),
        (200, []),
        (200, {"ok": False}),
        (200, {"ok": True, "payload": []}),
    ],
)
def test_remote_fails_closed(remote, monkeypatch, status, body):
    monkeypatch.setattr(
        httpx,
        "post",
        lambda url, **kw: httpx.Response(
            status, json=body, request=httpx.Request("POST", url)
        ),
    )
    with pytest.raises(OpenClawGatewayError):
        remote.health()


def test_missing_auth_never_falls_back_to_cli(remote, monkeypatch):
    monkeypatch.setattr(settings, "openclaw_gateway_token", None)
    with pytest.raises(OpenClawGatewayError):
        OpenClawGateway()


def test_channel_payload_must_have_real_booleans(remote, monkeypatch):
    monkeypatch.setattr(
        remote,
        "_rpc",
        lambda *args: {
            "channelAccounts": {"whatsapp": [{"accountId": "a", "connected": "false"}]}
        },
    )
    with pytest.raises(OpenClawGatewayError):
        remote.whatsapp_statuses()


def test_remote_pairing_without_provisioning_never_writes(remote, monkeypatch):
    monkeypatch.setattr(whatsapp_setup, "_require_owner", lambda *args: None)
    monkeypatch.setattr(whatsapp_setup, "_village", lambda *args: {"name": "Demo"})
    monkeypatch.setattr(whatsapp_setup, "_channel", lambda *args: None)
    monkeypatch.setattr(whatsapp_setup, "_gateway", lambda: remote)
    workspace = Mock()
    monkeypatch.setattr(whatsapp_setup, "get_openclaw_workspace_service", workspace)
    session = Mock()
    with pytest.raises(APIError) as error:
        whatsapp_setup.start_pairing(uuid4(), None, session, BackgroundTasks())
    assert error.value.status_code == 409
    assert error.value.code == "OPENCLAW_PROVISIONING_REQUIRED"
    workspace.assert_not_called()
    session.execute.assert_not_called()


def test_timeout_is_safe_and_does_not_retry_mutation(remote, monkeypatch):
    post = Mock(side_effect=httpx.ReadTimeout("private endpoint"))
    monkeypatch.setattr(httpx, "post", post)
    with pytest.raises(OpenClawGatewayError, match="Remote gateway timed out"):
        remote.logout("village-a")
    assert post.call_count == 1

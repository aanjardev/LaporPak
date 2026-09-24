from io import BytesIO
from unittest.mock import Mock
from uuid import uuid4

import pytest
from PIL import Image

from app.api.routes import health
from app.core.config import settings
from app.core.errors import APIError
from app.core.security import resolve_channel_unit
from app.services.image_validation import sanitize_image
from app.services.openclaw_gateway import OpenClawGatewayError


@pytest.mark.parametrize("enabled", [True, False, None])
def test_channel_kill_switch(enabled):
    unit = uuid4()
    session = Mock()
    session.execute.return_value.one_or_none.return_value = (
        unit,
        {"is_ai_enabled": enabled},
    )
    if enabled is False:
        with pytest.raises(APIError) as error:
            resolve_channel_unit(session, "channel-a")
        assert (error.value.status_code, error.value.code) == (503, "AI_DISABLED")
    else:
        assert resolve_channel_unit(session, "channel-a") == unit
    session.rollback.assert_called_once()


@pytest.mark.parametrize(
    "format,mime",
    [("JPEG", "image/jpeg"), ("PNG", "image/png"), ("WEBP", "image/webp")],
)
def test_image_reencoded_without_trailing_payload(format, mime):
    output = BytesIO()
    Image.new("RGB", (3, 2)).save(output, format=format)
    clean = sanitize_image(output.getvalue() + b"secret-trailing-payload", mime)
    assert b"secret-trailing-payload" not in clean
    with Image.open(BytesIO(clean)) as image:
        image.load()
        assert image.size == (3, 2)


@pytest.mark.parametrize(
    "data,mime",
    [
        (b"\xff\xd8\xff\x00", "image/jpeg"),
        (b"x" * (5 * 1024 * 1024 + 1), "image/png"),
        (b"test", "image/svg+xml"),
    ],
    ids=["truncated", "too-large", "unsupported"],
)
def test_invalid_images_rejected(data, mime):
    with pytest.raises(ValueError):
        sanitize_image(data, mime)


def test_oversized_dimensions_rejected_before_decode():
    output = BytesIO()
    Image.new("RGB", (10001, 1)).save(output, format="PNG")
    with pytest.raises(ValueError):
        sanitize_image(output.getvalue(), "image/png")


@pytest.mark.parametrize("database_ok,expected", [(True, 200), (False, 503)])
def test_readiness_gateway_degradation_does_not_fail_core(
    monkeypatch, database_ok, expected
):
    from pydantic import SecretStr
    from sqlalchemy.exc import SQLAlchemyError

    for name in (
        "database_url",
        "supabase_url",
        "supabase_publishable_key",
        "supabase_secret_key",
    ):
        monkeypatch.setattr(settings, name, "configured-test")
    monkeypatch.setattr(settings, "openclaw_api_key", SecretStr("test"))
    from unittest.mock import MagicMock

    engine = MagicMock()
    connection = engine.connect.return_value.__enter__.return_value
    connection.execute.return_value.scalar_one.return_value = 1
    if not database_ok:
        connection.execute.side_effect = SQLAlchemyError("private details")
    monkeypatch.setattr(health, "get_engine", lambda: engine)
    monkeypatch.setattr(
        health,
        "OpenClawGateway",
        Mock(side_effect=OpenClawGatewayError("private gateway")),
    )
    response = health.readiness_check()
    assert response.status_code == expected
    assert b'"openclaw":"degraded"' in response.body
    assert b"private" not in response.body

import logging
import re
import time
from collections.abc import Awaitable, Callable
from typing import Any

from app.core.config import settings

logger = logging.getLogger("laporpak.request_timing")
_UUID = re.compile(r"/[0-9a-f]{8}-[0-9a-f-]{27,}/", re.IGNORECASE)
_LONG_NUMBER = re.compile(r"/\d{8,}/")


def _route_name(scope: dict[str, Any]) -> str:
    route = scope.get("route")
    template = getattr(route, "path", None)
    if template:
        return str(template)
    path = str(scope.get("path", "/"))
    path = _UUID.sub("/:id/", path)
    return _LONG_NUMBER.sub("/:id/", path)


class RequestTimingMiddleware:
    """Log safe request timing during development without buffering responses."""

    def __init__(self, app: Callable[..., Awaitable[Any]]) -> None:
        self.app = app

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope.get("type") != "http" or settings.app_env.lower() != "development":
            await self.app(scope, receive, send)
            return

        started = time.perf_counter()
        status = 500
        response_bytes = 0

        async def send_timed(message: dict[str, Any]) -> None:
            nonlocal status, response_bytes
            if message.get("type") == "http.response.start":
                status = int(message.get("status", 500))
            elif message.get("type") == "http.response.body":
                response_bytes += len(message.get("body", b""))
            await send(message)

        try:
            await self.app(scope, receive, send_timed)
        finally:
            duration_ms = (time.perf_counter() - started) * 1000
            logger.info(
                "request_timing method=%s route=%s status=%s duration_ms=%.1f response_bytes=%s",
                scope.get("method", ""),
                _route_name(scope),
                status,
                duration_ms,
                response_bytes,
            )

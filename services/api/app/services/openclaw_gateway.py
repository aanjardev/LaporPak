"""Small adapter around the installed OpenClaw CLI and gateway contract."""

import json
import os
import re
import shutil
import subprocess
import time
from pathlib import Path
from threading import Lock
from typing import Any
from urllib.parse import urlsplit

import httpx

from app.core.config import settings


class OpenClawGatewayError(RuntimeError):
    pass


class OpenClawGatewayTimeoutError(OpenClawGatewayError):
    pass


_STATUS_CACHE_SECONDS = 5
_status_cache_lock = Lock()
_status_cache: tuple[float, dict[str, dict[str, Any]], str | None] | None = None
_gateway_restart_lock = Lock()
_gateway_restarted_at = 0.0
_GATEWAY_RESTART_COOLDOWN_SECONDS = 30


def _clear_status_cache() -> None:
    global _status_cache
    with _status_cache_lock:
        _status_cache = None


def _json_output(value: str) -> Any:
    decoder = json.JSONDecoder()
    for index, character in enumerate(value):
        if character not in "[{":
            continue
        try:
            candidate, end = decoder.raw_decode(value[index:])
        except json.JSONDecodeError:
            continue
        if not value[index + end :].strip():
            return candidate
    raise OpenClawGatewayError("OpenClaw returned an invalid response")


def _last_json(value: str) -> dict[str, Any]:
    result = _json_output(value)
    if not isinstance(result, dict):
        raise OpenClawGatewayError("OpenClaw returned an invalid response")
    return result


class OpenClawGateway:
    remote = False

    def __init__(self, cli_path: str | None = None) -> None:
        self.remote = bool(settings.openclaw_api_url.strip())
        if self.remote:
            url = urlsplit(settings.openclaw_api_url)
            if (
                url.scheme != "https"
                or not url.hostname
                or url.username
                or url.password
                or url.query
                or url.fragment
                or not settings.openclaw_gateway_token
                or not settings.openclaw_gateway_token.get_secret_value().strip()
                or not settings.cf_access_client_id
                or not settings.cf_access_client_secret
                or not settings.cf_access_client_secret.get_secret_value().strip()
            ):
                raise OpenClawGatewayError("Remote gateway configuration is invalid")
            self.rpc_url = settings.openclaw_api_url.rstrip("/") + "/api/v1/admin/rpc"
            return
        configured = cli_path or settings.openclaw_cli_path
        resolved = shutil.which(configured) or (
            configured if Path(configured).is_file() else None
        )
        if not resolved:
            raise OpenClawGatewayError("OpenClaw CLI is unavailable")
        self.cli_path = str(resolved)

    def _run(self, *args: str, timeout: int = 40) -> str:
        if self.remote:
            raise OpenClawGatewayError(
                "Local gateway operations are unavailable in remote mode"
            )
        command: str | list[str] = [self.cli_path, *args]
        use_shell = False
        if os.name == "nt" and self.cli_path.lower().endswith((".cmd", ".bat")):
            # Windows command shims require cmd.exe. Every dynamic argument
            # passed by this adapter is generated or sanitized below.
            command = subprocess.list2cmdline([self.cli_path, *args])
            use_shell = True
        try:
            completed = subprocess.run(
                command,
                shell=use_shell,
                check=False,
                capture_output=True,
                text=True,
                timeout=timeout,
                encoding="utf-8",
                errors="replace",
            )
        except subprocess.TimeoutExpired as exc:
            raise OpenClawGatewayTimeoutError("OpenClaw operation timed out") from exc
        except OSError as exc:
            raise OpenClawGatewayError("OpenClaw gateway is unavailable") from exc
        if completed.returncode != 0:
            raise OpenClawGatewayError("OpenClaw operation failed")
        return completed.stdout

    def _rpc(
        self, method: str, params: dict | None = None, *, timeout: float = 40
    ) -> dict:
        if method not in {
            "health",
            "channels.status",
            "channels.start",
            "channels.stop",
            "channels.logout",
            "web.login.start",
            "web.login.wait",
        }:
            raise OpenClawGatewayError("Unsupported gateway operation")
        try:
            response = httpx.post(
                self.rpc_url,
                headers={
                    "Authorization": f"Bearer {settings.openclaw_gateway_token.get_secret_value()}",
                    "CF-Access-Client-Id": settings.cf_access_client_id,
                    "CF-Access-Client-Secret": settings.cf_access_client_secret.get_secret_value(),
                },
                json={"method": method, "params": params or {}},
                timeout=httpx.Timeout(timeout, connect=5),
                follow_redirects=False,
            )
            response.raise_for_status()
            body = response.json()
            if not isinstance(body, dict) or body.get("ok") is not True:
                raise OpenClawGatewayError("Remote gateway operation failed")
            payload = body.get("payload")
            if not isinstance(payload, dict):
                raise OpenClawGatewayError("Remote gateway response is invalid")
            return payload
        except httpx.TimeoutException as exc:
            raise OpenClawGatewayTimeoutError("Remote gateway timed out") from exc
        except (httpx.HTTPError, ValueError) as exc:
            raise OpenClawGatewayError("Remote gateway is unavailable") from exc

    def health(self) -> None:
        if self.remote:
            self._rpc("health", timeout=5)
        else:
            self.whatsapp_statuses()

    def start_channel(self, account_id: str) -> None:
        self._rpc("channels.start", {"channel": "whatsapp", "accountId": account_id})

    def stop_channel(self, account_id: str) -> None:
        self._rpc("channels.stop", {"channel": "whatsapp", "accountId": account_id})

    def wait_pairing(self, account_id: str, session_key: str | None = None) -> None:
        params = {"channel": "whatsapp", "accountId": account_id, "timeoutMs": 30000}
        if session_key:
            params["sessionKey"] = session_key
        try:
            self._rpc("web.login.wait", params)
        except OpenClawGatewayError:
            # A later status probe exposes failure; never mark the channel connected here.
            return

    def ensure_whatsapp_account(
        self, account_id: str, display_name: str, agent_id: str = "laporpak"
    ) -> None:
        safe_name = re.sub(r"[^A-Za-z0-9 ._-]", "", display_name)[:80] or "Desa"
        account = None
        try:
            account = self.whatsapp_statuses()[0].get(account_id)
        except OpenClawGatewayError:
            # Keep the original provisioning path when status cannot be read.
            # The subsequent CLI call will return the actionable gateway error.
            pass
        configured = (
            account is not None
            and account.get("dmPolicy") == "open"
            and account.get("allowFrom") == ["*"]
            # `channels status` omits groupPolicy on some OpenClaw versions;
            # only reject it when the gateway explicitly reports another value.
            and account.get("groupPolicy", "disabled") == "disabled"
        )
        if not configured:
            self._run(
                "channels",
                "add",
                "--channel",
                "whatsapp",
                "--account",
                account_id,
                "--agent",
                agent_id,
                "--name",
                safe_name,
            )
            self._run(
                "config",
                "set",
                f'channels.whatsapp.accounts["{account_id}"].dmPolicy',
                '"open"',
                "--strict-json",
            )
            self._run(
                "config",
                "set",
                f'channels.whatsapp.accounts["{account_id}"].allowFrom',
                '["*"]',
                "--strict-json",
            )
            self._run(
                "config",
                "set",
                f'channels.whatsapp.accounts["{account_id}"].groupPolicy',
                '"disabled"',
                "--strict-json",
            )
        bindings = _json_output(self._run("agents", "bindings", "--json"))
        if not isinstance(bindings, list):
            raise OpenClawGatewayError("OpenClaw returned invalid bindings")
        for binding in bindings:
            match = binding.get("match", {})
            owner = binding.get("agentId")
            if (
                match.get("channel") == "whatsapp"
                and match.get("accountId") == account_id
                and owner != agent_id
            ):
                self._run(
                    "agents",
                    "unbind",
                    "--agent",
                    str(owner),
                    "--bind",
                    f"whatsapp:{account_id}",
                    "--json",
                )
        self._run(
            "agents",
            "bind",
            "--agent",
            agent_id,
            "--bind",
            f"whatsapp:{account_id}",
            "--json",
        )
        _clear_status_cache()

    def ensure_village_agent(self, agent_id: str, workspace: Path) -> None:
        agents = _json_output(self._run("agents", "list", "--json"))
        if not isinstance(agents, list):
            raise OpenClawGatewayError("OpenClaw returned an invalid agent list")
        created = not any(item.get("id") == agent_id for item in agents)
        if created:
            self._run(
                "agents",
                "add",
                agent_id,
                "--workspace",
                str(workspace),
                "--model",
                "google/gemini-3.1-flash-lite",
                "--non-interactive",
                "--json",
                timeout=60,
            )
        allowed_tools = [
            "llm-task",
            "laporpak_create_report",
            "laporpak_ask",
            "laporpak_track_report",
            "laporpak_get_report_document",
            "laporpak_create_service_request",
            "laporpak_detect_emergency",
            "laporpak_check_similar",
            "laporpak_confirm_resolution",
        ]
        if created:
            # ponytail: do not rewrite an existing agent config on every QR
            # request; OpenClaw's Windows config writer can block while the
            # gateway is reloading the same file.
            self._run(
                "config",
                "set",
                f'agents.entries["{agent_id}"].tools.allow',
                json.dumps(allowed_tools, separators=(",", ":")),
                "--strict-json",
            )

    def start_pairing(self, account_id: str) -> dict[str, Any]:
        if self.remote:
            result = self._rpc(
                "web.login.start",
                {
                    "channel": "whatsapp",
                    "accountId": account_id,
                    "force": True,
                    "timeoutMs": 30000,
                },
            )
            if "connected" in result and not isinstance(result["connected"], bool):
                raise OpenClawGatewayError("Invalid pairing status")
            for key in ("qrDataUrl", "sessionKey"):
                if result.get(key) is not None and not isinstance(result[key], str):
                    raise OpenClawGatewayError("Invalid pairing response")
            if not result.get("connected") and not result.get("qrDataUrl"):
                raise OpenClawGatewayError("No pairing result available")
            return result
        # WhatsApp does not emit plugin message_received hooks by default.
        # The report tool needs this hook to retain the citizen's photo.
        self._run(
            "config",
            "set",
            f'channels.whatsapp.accounts["{account_id}"].pluginHooks.messageReceived',
            "true",
            "--strict-json",
        )
        payload = json.dumps(
            {
                "channel": "whatsapp",
                "accountId": account_id,
                "force": True,
                "timeoutMs": 30000,
            },
            separators=(",", ":"),
        )
        result = _last_json(
            self._run(
                "gateway",
                "call",
                "web.login.start",
                "--json",
                "--timeout",
                "35000",
                "--params",
                payload,
            )
        )
        _clear_status_cache()
        return result

    def restart(self) -> None:
        """Restart a linked channel runtime once after QR pairing."""
        global _gateway_restarted_at
        # ponytail: one local gateway needs only process-local coordination.
        # Use shared coordination if the API is deployed with multiple workers.
        if not _gateway_restart_lock.acquire(blocking=False):
            return
        try:
            now = time.monotonic()
            if now - _gateway_restarted_at < _GATEWAY_RESTART_COOLDOWN_SECONDS:
                return
            try:
                self._run("gateway", "restart", timeout=60)
            except OpenClawGatewayTimeoutError:
                # The Windows scheduled-task command can keep its parent shim
                # open after the replacement gateway is already healthy.
                _clear_status_cache()
                self.whatsapp_statuses()
            _gateway_restarted_at = time.monotonic()
            _clear_status_cache()
        finally:
            _gateway_restart_lock.release()

    def whatsapp_statuses(self) -> tuple[dict[str, dict[str, Any]], str | None]:
        if self.remote:
            snapshot = self._rpc("channels.status", {"probe": True, "timeoutMs": 10000})
            channel_accounts = snapshot.get("channelAccounts")
            if not isinstance(channel_accounts, dict):
                raise OpenClawGatewayError("Invalid channel response")
            accounts = channel_accounts.get("whatsapp", [])
            if not isinstance(accounts, list):
                raise OpenClawGatewayError("Invalid channel response")
            result = {}
            for account in accounts:
                if not isinstance(account, dict) or not isinstance(
                    account.get("accountId"), str
                ):
                    raise OpenClawGatewayError("Invalid channel identity")
                if any(
                    key in account and not isinstance(account[key], bool)
                    for key in ("connected", "linked", "running")
                ):
                    raise OpenClawGatewayError("Invalid channel status")
                identity = account.get("self")
                if identity is not None and (
                    not isinstance(identity, dict)
                    or (
                        identity.get("e164") is not None
                        and not isinstance(identity["e164"], str)
                    )
                ):
                    raise OpenClawGatewayError("Invalid channel identity")
                result[account["accountId"]] = account
            return result, None
        global _status_cache
        with _status_cache_lock:
            now = time.monotonic()
            if _status_cache and now - _status_cache[0] < _STATUS_CACHE_SECONDS:
                return _status_cache[1], _status_cache[2]
            snapshot = _last_json(
                self._run(
                    "channels",
                    "status",
                    "--channel",
                    "whatsapp",
                    "--probe",
                    "--json",
                    timeout=12,
                )
            )
            if not snapshot.get("gatewayReachable", True):
                raise OpenClawGatewayError("OpenClaw gateway is unavailable")
            accounts = snapshot.get("channelAccounts", {}).get("whatsapp", [])
            default_id = snapshot.get("channelDefaultAccountId", {}).get("whatsapp")
            result = {
                str(item.get("accountId")): dict(item)
                for item in accounts
                if item.get("accountId")
            }
            if default_id and default_id not in result:
                result[default_id] = dict(
                    snapshot.get("channels", {}).get("whatsapp") or {}
                )
            if default_id in result:
                result[default_id]["self"] = (
                    snapshot.get("channels", {}).get("whatsapp", {}).get("self")
                )
            _status_cache = (now, result, default_id)
            return result, default_id

    def status(self, account_id: str) -> dict[str, Any]:
        statuses, _ = self.whatsapp_statuses()
        account = statuses.get(account_id)
        result = dict(
            account or {"accountId": account_id, "connected": False, "linked": False}
        )
        return result

    def logout(self, account_id: str) -> None:
        if self.remote:
            self._rpc(
                "channels.logout", {"channel": "whatsapp", "accountId": account_id}
            )
            return
        payload = json.dumps(
            {"channel": "whatsapp", "accountId": account_id},
            separators=(",", ":"),
        )
        self._run(
            "gateway",
            "call",
            "channels.logout",
            "--json",
            "--params",
            payload,
        )
        _clear_status_cache()

    def send_document(
        self,
        *,
        account_id: str,
        target: str,
        path: Path,
        message: str,
    ) -> dict[str, Any]:
        return _last_json(
            self._run(
                "message",
                "send",
                "--channel",
                "whatsapp",
                "--account",
                account_id,
                "--target",
                target,
                "--media",
                str(path),
                "--message",
                message,
                "--force-document",
                "--json",
                timeout=45,
            )
        )

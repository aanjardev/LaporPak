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

from app.core.config import settings


class OpenClawGatewayError(RuntimeError):
    pass


_STATUS_CACHE_SECONDS = 5
_status_cache_lock = Lock()
_status_cache: tuple[float, dict[str, dict[str, Any]], str | None] | None = None


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
    def __init__(self, cli_path: str | None = None) -> None:
        configured = cli_path or settings.openclaw_cli_path
        resolved = shutil.which(configured) or (
            configured if Path(configured).is_file() else None
        )
        if not resolved:
            raise OpenClawGatewayError("OpenClaw CLI is unavailable")
        self.cli_path = str(resolved)

    def _run(self, *args: str, timeout: int = 40) -> str:
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
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise OpenClawGatewayError("OpenClaw gateway is unavailable") from exc
        if completed.returncode != 0:
            raise OpenClawGatewayError("OpenClaw operation failed")
        return completed.stdout

    def ensure_whatsapp_account(
        self, account_id: str, display_name: str, agent_id: str = "laporpak"
    ) -> None:
        safe_name = re.sub(r"[^A-Za-z0-9 ._-]", "", display_name)[:80] or "Desa"
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
        if not any(item.get("id") == agent_id for item in agents):
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
            "laporpak_create_service_request",
            "laporpak_detect_emergency",
            "laporpak_check_similar",
            "laporpak_confirm_resolution",
        ]
        self._run(
            "config",
            "set",
            f'agents.entries["{agent_id}"].tools.allow',
            json.dumps(allowed_tools, separators=(",", ":")),
            "--strict-json",
        )

    def start_pairing(self, account_id: str) -> dict[str, Any]:
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

    def whatsapp_statuses(self) -> tuple[dict[str, dict[str, Any]], str | None]:
        global _status_cache
        with _status_cache_lock:
            now = time.monotonic()
            if _status_cache and now - _status_cache[0] < _STATUS_CACHE_SECONDS:
                return _status_cache[1], _status_cache[2]
            snapshot = _last_json(
                self._run(
                    "channels", "status", "--channel", "whatsapp", "--probe", "--json",
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
                result[default_id] = dict(snapshot.get("channels", {}).get("whatsapp") or {})
            if default_id in result:
                result[default_id]["self"] = snapshot.get("channels", {}).get(
                    "whatsapp", {}
                ).get("self")
            _status_cache = (now, result, default_id)
            return result, default_id

    def status(self, account_id: str) -> dict[str, Any]:
        statuses, _ = self.whatsapp_statuses()
        account = statuses.get(account_id)
        result = dict(
            account
            or {"accountId": account_id, "connected": False, "linked": False}
        )
        return result

    def logout(self, account_id: str) -> None:
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

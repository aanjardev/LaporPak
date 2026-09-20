from uuid import UUID

import pytest

from app.api.routes.admin import profile_complete
from app.core.errors import APIError
from app.core.security import (
    AdminRole,
    AuthenticatedCaller,
    CallerType,
    operator_scope,
    require_village_operator,
)
from app.services.openclaw_gateway import (
    OpenClawGateway,
    _clear_status_cache,
    _json_output,
)

UNIT_ID = UUID("00000000-0000-4000-8000-000000000002")


def caller(role: AdminRole, operational=()) -> AuthenticatedCaller:
    return AuthenticatedCaller(
        caller_type=CallerType.ADMIN,
        identifier="test",
        role=role,
        unit_ids=(UNIT_ID,) if role is AdminRole.VILLAGE_ADMIN else (),
        operational_unit_ids=operational,
    )


def test_only_approved_village_admin_is_an_operational_caller():
    with pytest.raises(APIError):
        require_village_operator(caller(AdminRole.SYSTEM_ADMIN))
    with pytest.raises(APIError):
        require_village_operator(caller(AdminRole.VILLAGE_ADMIN))

    approved = caller(AdminRole.VILLAGE_ADMIN, (UNIT_ID,))
    assert require_village_operator(approved) == approved
    assert operator_scope(approved) == (UNIT_ID,)


def test_activation_completeness_uses_account_and_required_village_fields():
    account = {"display_name": "Admin Desa", "contact_phone": "+62812345678"}
    village = {
        "name": "Desa Uji",
        "metadata": {
            "village_code": "33.01",
            "province": "Jawa Tengah",
            "regency": "Kabupaten Uji",
            "district": "Kecamatan Uji",
            "address": "Jalan Desa 1",
            "contact_phone": "+62812345678",
            "office_hours": "Senin-Jumat 08.00-15.00",
        },
    }
    assert profile_complete(account, village) is True
    village["metadata"]["office_hours"] = ""
    assert profile_complete(account, village) is False


def test_openclaw_json_parser_ignores_runtime_warnings():
    output = 'runtime warning\n{"channels":{"whatsapp":{"connected":true}}}\n'
    assert _json_output(output)["channels"]["whatsapp"]["connected"] is True


def test_whatsapp_binding_moves_exact_account_to_village_agent(monkeypatch, tmp_path):
    cli = tmp_path / "openclaw.exe"
    cli.write_text("")
    gateway = OpenClawGateway(str(cli))
    calls = []

    def fake_run(*args, **_kwargs):
        calls.append(args)
        if args[:3] == ("agents", "bindings", "--json"):
            return '[{"agentId":"laporpak","match":{"channel":"whatsapp","accountId":"default"}}]'
        return "{}"

    monkeypatch.setattr(gateway, "_run", fake_run)
    gateway.ensure_whatsapp_account("default", "Desa Uji & Aman", "laporpak-unit")

    assert (
        "agents",
        "unbind",
        "--agent",
        "laporpak",
        "--bind",
        "whatsapp:default",
        "--json",
    ) in calls
    assert (
        "agents",
        "bind",
        "--agent",
        "laporpak-unit",
        "--bind",
        "whatsapp:default",
        "--json",
    ) in calls


def test_openclaw_status_snapshot_is_reused_for_concurrent_dashboard_reads(
    monkeypatch, tmp_path
):
    cli = tmp_path / "openclaw.exe"
    cli.write_text("")
    gateway = OpenClawGateway(str(cli))
    calls = []

    def fake_run(*args, **_kwargs):
        calls.append(args)
        return (
            '{"gatewayReachable":true,"channelAccounts":{"whatsapp":'
            '[{"accountId":"default","connected":true,"linked":true}]},'
            '"channelDefaultAccountId":{"whatsapp":"default"},'
            '"channels":{"whatsapp":{"self":{"e164":"+62000"}}}}'
        )

    _clear_status_cache()
    monkeypatch.setattr(gateway, "_run", fake_run)

    first, default_id = gateway.whatsapp_statuses()
    second, _ = gateway.whatsapp_statuses()

    assert default_id == "default"
    assert first == second
    assert len(calls) == 1
    _clear_status_cache()

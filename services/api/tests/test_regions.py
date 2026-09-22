import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.errors import APIError
from app.core.security import SupabaseIdentity, authenticate_identity
from app.main import app
from app.schemas.admin import VillageOnboardingCreate
from app.services.regions import list_regions, validate_village_region

IDENTITY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

DATA = {
    "provinces": [{"code": "31", "name": "DKI Jakarta"}],
    "regencies/31": [{"code": "31.74", "name": "Kota Administrasi Jakarta Selatan"}],
    "districts/31.74": [{"code": "31.74.09", "name": "Jagakarsa"}],
    "villages/31.74.09": [{"code": "31.74.09.1005", "name": "Tanjung Barat"}],
}


class Response:
    def __init__(self, data):
        self.data = data

    def raise_for_status(self):
        return None

    def json(self):
        return {"data": self.data}


def fake_get(url: str, **_kwargs):
    key = url.removeprefix("https://wilayah.id/api/").removesuffix(".json")
    return Response(DATA[key])


def test_village_region_hierarchy_is_validated(monkeypatch):
    monkeypatch.setattr("app.services.regions.httpx.get", fake_get)

    validate_village_region(
        village_code="31.74.09.1005",
        village_name="Tanjung Barat",
        province="DKI Jakarta",
        regency="Kota Administrasi Jakarta Selatan",
        district="Jagakarsa",
    )

    with pytest.raises(APIError) as error:
        validate_village_region(
            village_code="31.74.09.1005",
            village_name="Desa Tidak Sesuai",
            province="DKI Jakarta",
            regency="Kota Administrasi Jakarta Selatan",
            district="Jagakarsa",
        )
    assert error.value.code == "INVALID_REGION"


def test_region_service_failure_is_safe(monkeypatch):
    def fail(*_args, **_kwargs):
        raise httpx.ConnectError("offline")

    monkeypatch.setattr("app.services.regions.httpx.get", fail)
    with pytest.raises(APIError) as error:
        list_regions("provinces")
    assert error.value.status_code == 503
    assert error.value.code == "REGION_SERVICE_UNAVAILABLE"


def test_onboarding_rejects_free_form_village_code_and_phone():
    base = {
        "display_name": "Admin Desa",
        "contact_phone": "+628123456789",
        "village_name": "Tanjung Barat",
        "village_code": "31.74.09.1005",
        "province": "DKI Jakarta",
        "regency": "Kota Administrasi Jakarta Selatan",
        "district": "Jagakarsa",
        "address": "Jalan Desa 1",
        "service_contact_phone": "08123456789",
        "office_hours": "Senin-Jumat 08.00-15.00",
    }
    VillageOnboardingCreate.model_validate(base)
    with pytest.raises(ValidationError):
        VillageOnboardingCreate.model_validate({**base, "village_code": "kode-bebas"})
    with pytest.raises(ValidationError):
        VillageOnboardingCreate.model_validate({**base, "contact_phone": "0812-ABC"})


def test_region_route_requires_verified_email(monkeypatch):
    monkeypatch.setattr("app.api.routes.regions.list_regions", lambda *_args: [])
    app.dependency_overrides[authenticate_identity] = lambda: SupabaseIdentity(
        id=IDENTITY_ID,
        email="admin@example.test",
        email_verified=False,
    )
    try:
        response = TestClient(app).get(
            "/api/v1/regions/provinces",
            headers={"Authorization": "Bearer test-token"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "EMAIL_NOT_VERIFIED"


def test_region_route_returns_reference_items_for_verified_email(monkeypatch):
    monkeypatch.setattr(
        "app.api.routes.regions.list_regions",
        lambda *_args: [{"code": "31", "name": "DKI Jakarta"}],
    )
    app.dependency_overrides[authenticate_identity] = lambda: SupabaseIdentity(
        id=IDENTITY_ID,
        email="admin@example.test",
        email_verified=True,
    )
    try:
        response = TestClient(app).get(
            "/api/v1/regions/provinces",
            headers={"Authorization": "Bearer test-token"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"items": [{"code": "31", "name": "DKI Jakarta"}]}

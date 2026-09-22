import re

import httpx

from app.core.errors import APIError
from app.schemas.region import RegionItem

BASE_URL = "https://wilayah.id/api"
CODE_PATTERNS = {
    "provinces": re.compile(r"^$"),
    "regencies": re.compile(r"^\d{2}$"),
    "districts": re.compile(r"^\d{2}\.\d{2}$"),
    "villages": re.compile(r"^\d{2}\.\d{2}\.\d{2}$"),
}


def list_regions(level: str, parent_code: str = "") -> list[RegionItem]:
    pattern = CODE_PATTERNS.get(level)
    if pattern is None or pattern.fullmatch(parent_code) is None:
        raise APIError(
            status_code=422,
            code="INVALID_REGION_CODE",
            message="Kode wilayah tidak valid",
        )
    suffix = f"/{parent_code}" if parent_code else ""
    try:
        response = httpx.get(f"{BASE_URL}/{level}{suffix}.json", timeout=8.0)
        response.raise_for_status()
        data = response.json().get("data", [])
        return [
            RegionItem(code=str(item["code"]), name=str(item["name"]))
            for item in data
            if item.get("code") and item.get("name")
        ]
    except (httpx.HTTPError, TypeError, ValueError, KeyError) as exc:
        raise APIError(
            status_code=503,
            code="REGION_SERVICE_UNAVAILABLE",
            message="Data wilayah belum dapat dimuat. Coba lagi beberapa saat.",
        ) from exc


def validate_village_region(
    *, village_code: str, village_name: str, province: str, regency: str, district: str
) -> None:
    parts = village_code.split(".")
    if len(parts) != 4 or any(not part.isdigit() for part in parts):
        raise APIError(status_code=422, code="INVALID_REGION", message="Kode desa tidak valid")
    codes = (parts[0], ".".join(parts[:2]), ".".join(parts[:3]), village_code)
    expected = (province, regency, district, village_name)
    lookups = (
        list_regions("provinces"),
        list_regions("regencies", codes[0]),
        list_regions("districts", codes[1]),
        list_regions("villages", codes[2]),
    )
    for items, code, name in zip(lookups, codes, expected, strict=True):
        if not any(item.code == code and item.name.casefold() == name.casefold() for item in items):
            raise APIError(
                status_code=422,
                code="INVALID_REGION",
                message="Pilihan provinsi, kabupaten/kota, kecamatan, dan desa tidak sesuai.",
            )

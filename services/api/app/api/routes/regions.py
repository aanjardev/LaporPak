from fastapi import APIRouter, Query

from app.core.errors import APIError
from app.core.security import SupabaseIdentity, SupabaseIdentityDependency
from app.schemas.region import RegionListResponse
from app.services.regions import list_regions

router = APIRouter(prefix="/api/v1/regions", tags=["Regions"])


def require_verified(identity: SupabaseIdentity) -> None:
    if not identity.email_verified:
        raise APIError(
            status_code=403,
            code="EMAIL_NOT_VERIFIED",
            message="Verify your email before selecting a village",
        )


@router.get("/provinces", response_model=RegionListResponse)
def provinces(identity: SupabaseIdentityDependency) -> RegionListResponse:
    require_verified(identity)
    return RegionListResponse(items=list_regions("provinces"))


@router.get("/regencies", response_model=RegionListResponse)
def regencies(
    identity: SupabaseIdentityDependency,
    province_code: str = Query(pattern=r"^\d{2}$"),
) -> RegionListResponse:
    require_verified(identity)
    return RegionListResponse(items=list_regions("regencies", province_code))


@router.get("/districts", response_model=RegionListResponse)
def districts(
    identity: SupabaseIdentityDependency,
    regency_code: str = Query(pattern=r"^\d{2}\.\d{2}$"),
) -> RegionListResponse:
    require_verified(identity)
    return RegionListResponse(items=list_regions("districts", regency_code))


@router.get("/villages", response_model=RegionListResponse)
def villages(
    identity: SupabaseIdentityDependency,
    district_code: str = Query(pattern=r"^\d{2}\.\d{2}\.\d{2}$"),
) -> RegionListResponse:
    require_verified(identity)
    return RegionListResponse(items=list_regions("villages", district_code))

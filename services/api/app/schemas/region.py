from pydantic import BaseModel, ConfigDict


class RegionItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str
    name: str


class RegionListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[RegionItem]

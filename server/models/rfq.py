from decimal import Decimal
from datetime import date, datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator


class RFQCreate(BaseModel):
    item_name: str = Field(..., min_length=1, max_length=255)
    material_spec: str | None = None
    quantity: Decimal = Field(..., gt=0)
    delivery_expectation: date | None = None
    notes: str | None = None

    @field_validator("item_name")
    @classmethod
    def item_name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("item_name must not be blank")
        return v


class RFQResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    item_name: str
    material_spec: str | None
    quantity: Decimal
    delivery_expectation: date | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
    quote_count: int


class RFQListResponse(BaseModel):
    items: list[RFQResponse]
    total: int
    limit: int
    offset: int

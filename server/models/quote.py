from decimal import Decimal
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator

from models.rfq import RFQResponse


class QuoteCreate(BaseModel):
    supplier_name: str = Field(..., min_length=1, max_length=255)
    unit_price: Decimal = Field(..., ge=0)
    currency: str = Field(default="USD")
    lead_time_days: int | None = Field(default=None, ge=0)
    payment_terms: str | None = Field(default=None, max_length=255)
    remarks: str | None = None

    @field_validator("supplier_name")
    @classmethod
    def supplier_name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("supplier_name must not be blank")
        return v

    @field_validator("currency", mode="before")
    @classmethod
    def currency_uppercase(cls, v: str) -> str:
        return v.upper() if v else v

    @field_validator("currency")
    @classmethod
    def currency_three_chars(cls, v: str) -> str:
        if not v.isalpha() or len(v) != 3:
            raise ValueError("currency must be exactly 3 alphabetic characters")
        return v


class QuoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    rfq_id: UUID
    supplier_name: str
    unit_price: Decimal
    currency: str
    lead_time_days: int | None
    payment_terms: str | None
    remarks: str | None
    source: str
    created_at: datetime
    total_price: Decimal
    is_best_quote: bool
    delivery_risk: bool


class QuoteSummary(BaseModel):
    quote_count: int
    min_total_price: Decimal | None
    max_total_price: Decimal | None
    currency_warning: bool


class QuoteListResponse(BaseModel):
    rfq: RFQResponse
    quotes: list[QuoteResponse]
    best_quote_id: UUID | None
    summary: QuoteSummary

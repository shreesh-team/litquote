from decimal import Decimal
from uuid import UUID


def enrich_quotes(quotes: list[dict], rfq_quantity: Decimal) -> tuple[list[dict], UUID | None]:
    if not quotes:
        return [], None

    for q in quotes:
        q["total_price"] = q["unit_price"] * rfq_quantity

    min_total = min(q["total_price"] for q in quotes)
    best_quote_id: UUID | None = None

    for q in quotes:
        q["is_best_quote"] = q["total_price"] == min_total
        if q["is_best_quote"] and best_quote_id is None:
            best_quote_id = q["id"]

    return quotes, best_quote_id

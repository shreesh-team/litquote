from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID


def enrich_quotes(
    quotes: list[dict],
    rfq_quantity: Decimal,
    delivery_expectation: date | None = None,
    awarded_quote_id: UUID | None = None,
) -> tuple[list[dict], UUID | None]:
    if not quotes:
        return [], None

    for q in quotes:
        q["total_price"] = q["unit_price"] * rfq_quantity

        lead = q.get("lead_time_days")
        if lead is not None and delivery_expectation is not None:
            q["delivery_risk"] = (date.today() + timedelta(days=lead)) > delivery_expectation
        else:
            q["delivery_risk"] = False

        q["is_awarded"] = (q["id"] == awarded_quote_id) if awarded_quote_id else False

    min_total = min(q["total_price"] for q in quotes)
    best_quote_id: UUID | None = None

    for q in quotes:
        q["is_best_quote"] = q["total_price"] == min_total
        if q["is_best_quote"] and best_quote_id is None:
            best_quote_id = q["id"]

    # cheapest first; break ties by lead time (shorter is better; None sorts last)
    quotes.sort(key=lambda q: (q["total_price"], q["lead_time_days"] if q["lead_time_days"] is not None else float("inf")))
    return quotes, best_quote_id

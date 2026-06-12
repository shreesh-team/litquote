from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from psycopg2.extensions import connection as PgConnection
from pydantic import BaseModel

from db.connection import get_db
from models.rfq import RFQResponse
from models.quote import QuoteCreate, QuoteUpdate, QuoteResponse, QuoteListResponse, QuoteSummary
from services.comparison import enrich_quotes

router = APIRouter(tags=["quotes"])

_QUOTE_COLS = """
    q.id, q.rfq_id, q.supplier_name, q.unit_price, q.currency,
    q.lead_time_days, q.payment_terms, q.remarks, q.source, q.created_at, q.updated_at
"""

_RFQ_COLS = """
    r.id, r.item_name, r.material_spec, r.quantity, r.delivery_expectation,
    r.notes, r.status, r.awarded_quote_id, r.created_at, r.updated_at,
    COALESCE((SELECT COUNT(*) FROM supplier_quote sq WHERE sq.rfq_id = r.id), 0)::int AS quote_count
"""


class AwardRequest(BaseModel):
    quote_id: UUID


def _quote_row_to_dict(row) -> dict:
    return {
        "id": row[0],
        "rfq_id": row[1],
        "supplier_name": row[2],
        "unit_price": row[3],
        "currency": row[4],
        "lead_time_days": row[5],
        "payment_terms": row[6],
        "remarks": row[7],
        "source": row[8],
        "created_at": row[9],
        "updated_at": row[10],
    }


def _rfq_row_to_dict(row) -> dict:
    return {
        "id": row[0],
        "item_name": row[1],
        "material_spec": row[2],
        "quantity": row[3],
        "delivery_expectation": row[4],
        "notes": row[5],
        "status": row[6],
        "awarded_quote_id": row[7],
        "created_at": row[8],
        "updated_at": row[9],
        "quote_count": row[10],
    }


def _get_rfq_or_404(db: PgConnection, rfq_id: UUID) -> dict:
    with db.cursor() as cur:
        cur.execute(
            f"SELECT {_RFQ_COLS} FROM rfq r WHERE r.id = %s",
            (str(rfq_id),),
        )
        row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="RFQ not found")
    return _rfq_row_to_dict(row)


def _check_rfq_mutable(rfq: dict) -> None:
    if rfq["status"] == "awarded":
        raise HTTPException(status_code=409, detail="This RFQ has been awarded and is locked.")
    if rfq["status"] == "void":
        raise HTTPException(status_code=409, detail="This RFQ has been voided and cannot be modified.")


@router.post("/api/rfq/{rfq_id}/quotes", status_code=201, response_model=QuoteResponse)
def add_quote(rfq_id: UUID, body: QuoteCreate, db: PgConnection = Depends(get_db)):
    rfq = _get_rfq_or_404(db, rfq_id)
    _check_rfq_mutable(rfq)

    with db.cursor() as cur:
        cur.execute(
            """
            INSERT INTO supplier_quote
                (rfq_id, supplier_name, unit_price, currency, lead_time_days, payment_terms, remarks, source)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'manual')
            RETURNING id, rfq_id, supplier_name, unit_price, currency,
                      lead_time_days, payment_terms, remarks, source, created_at, updated_at
            """,
            (
                str(rfq_id),
                body.supplier_name,
                body.unit_price,
                body.currency,
                body.lead_time_days,
                body.payment_terms,
                body.remarks,
            ),
        )
        new_row = cur.fetchone()

        cur.execute(
            f"SELECT {_QUOTE_COLS} FROM supplier_quote q WHERE q.rfq_id = %s",
            (str(rfq_id),),
        )
        all_rows = cur.fetchall()
        db.commit()

    all_quotes = [_quote_row_to_dict(r) for r in all_rows]
    enriched, _ = enrich_quotes(
        all_quotes, rfq["quantity"], rfq.get("delivery_expectation"), rfq.get("awarded_quote_id")
    )

    new_id = new_row[0]
    enriched_new = next((q for q in enriched if q["id"] == new_id), None)
    if enriched_new is None:
        raise HTTPException(status_code=500, detail="Failed to enrich new quote")
    return QuoteResponse(**enriched_new)


@router.get("/api/rfq/{rfq_id}/quotes", response_model=QuoteListResponse)
def list_quotes(rfq_id: UUID, db: PgConnection = Depends(get_db)):
    rfq = _get_rfq_or_404(db, rfq_id)

    with db.cursor() as cur:
        cur.execute(
            f"SELECT {_QUOTE_COLS} FROM supplier_quote q WHERE q.rfq_id = %s",
            (str(rfq_id),),
        )
        rows = cur.fetchall()

    quotes = [_quote_row_to_dict(r) for r in rows]
    enriched, best_quote_id = enrich_quotes(
        quotes, rfq["quantity"], rfq.get("delivery_expectation"), rfq.get("awarded_quote_id")
    )

    totals = [q["total_price"] for q in enriched] if enriched else []
    currencies = {q["currency"] for q in enriched}

    summary = QuoteSummary(
        quote_count=len(enriched),
        min_total_price=min(totals) if totals else None,
        max_total_price=max(totals) if totals else None,
        currency_warning=len(currencies) > 1,
    )

    return QuoteListResponse(
        rfq=RFQResponse(**rfq),
        quotes=[QuoteResponse(**q) for q in enriched],
        best_quote_id=best_quote_id,
        summary=summary,
    )


@router.put("/api/quote/{quote_id}", response_model=QuoteResponse)
def update_quote(quote_id: UUID, body: QuoteUpdate, db: PgConnection = Depends(get_db)):
    # Fetch quote and check lock before making any changes
    with db.cursor() as cur:
        cur.execute("SELECT rfq_id FROM supplier_quote WHERE id = %s", (str(quote_id),))
        row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Quote not found")

    rfq_id = row[0]
    rfq = _get_rfq_or_404(db, rfq_id)
    _check_rfq_mutable(rfq)

    updates = body.model_dump(exclude_unset=True)

    if updates:
        with db.cursor() as cur:
            set_parts = [f"{k} = %s" for k in updates] + ["updated_at = now()"]
            params = list(updates.values()) + [str(quote_id)]
            cur.execute(
                f"UPDATE supplier_quote SET {', '.join(set_parts)} WHERE id = %s",
                params,
            )
            db.commit()
        rfq = _get_rfq_or_404(db, rfq_id)

    with db.cursor() as cur:
        cur.execute(
            f"SELECT {_QUOTE_COLS} FROM supplier_quote q WHERE q.rfq_id = %s",
            (str(rfq_id),),
        )
        all_rows = cur.fetchall()

    all_quotes = [_quote_row_to_dict(r) for r in all_rows]
    enriched, _ = enrich_quotes(
        all_quotes, rfq["quantity"], rfq.get("delivery_expectation"), rfq.get("awarded_quote_id")
    )

    quote_id_str = str(quote_id)
    updated_quote = next((q for q in enriched if str(q["id"]) == quote_id_str), None)
    if updated_quote is None:
        raise HTTPException(status_code=500, detail="Failed to enrich updated quote")
    return QuoteResponse(**updated_quote)


@router.post("/api/rfq/{rfq_id}/award", response_model=RFQResponse)
def award_rfq(rfq_id: UUID, body: AwardRequest, db: PgConnection = Depends(get_db)):
    rfq = _get_rfq_or_404(db, rfq_id)
    if rfq["status"] == "void":
        raise HTTPException(status_code=409, detail="A voided RFQ cannot be awarded.")
    if rfq["status"] == "awarded":
        raise HTTPException(status_code=409, detail="This RFQ has already been awarded.")

    with db.cursor() as cur:
        cur.execute(
            "SELECT id FROM supplier_quote WHERE id = %s AND rfq_id = %s",
            (str(body.quote_id), str(rfq_id)),
        )
        if cur.fetchone() is None:
            raise HTTPException(status_code=400, detail="Quote does not belong to this RFQ")

        cur.execute(
            "UPDATE rfq SET status = 'awarded', awarded_quote_id = %s, updated_at = now() WHERE id = %s",
            (str(body.quote_id), str(rfq_id)),
        )
        db.commit()

    rfq = _get_rfq_or_404(db, rfq_id)
    return RFQResponse(**rfq)


@router.delete("/api/quote/{quote_id}", status_code=204)
def delete_quote(quote_id: UUID, db: PgConnection = Depends(get_db)):
    with db.cursor() as cur:
        cur.execute("SELECT rfq_id FROM supplier_quote WHERE id = %s", (str(quote_id),))
        row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Quote not found")

    rfq = _get_rfq_or_404(db, row[0])
    _check_rfq_mutable(rfq)

    with db.cursor() as cur:
        cur.execute(
            "DELETE FROM supplier_quote WHERE id = %s RETURNING id",
            (str(quote_id),),
        )
        deleted = cur.fetchone()
        db.commit()
    if deleted is None:
        raise HTTPException(status_code=404, detail="Quote not found")

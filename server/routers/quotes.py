from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from psycopg2.extensions import connection as PgConnection

from db.connection import get_db
from models.rfq import RFQResponse
from models.quote import QuoteCreate, QuoteResponse, QuoteListResponse, QuoteSummary
from services.comparison import enrich_quotes

router = APIRouter(tags=["quotes"])

_QUOTE_COLS = """
    q.id, q.rfq_id, q.supplier_name, q.unit_price, q.currency,
    q.lead_time_days, q.payment_terms, q.remarks, q.source, q.created_at
"""

_RFQ_COLS = """
    r.id, r.item_name, r.material_spec, r.quantity, r.delivery_expectation,
    r.notes, r.created_at, r.updated_at,
    COALESCE((SELECT COUNT(*) FROM supplier_quote sq WHERE sq.rfq_id = r.id), 0)::int AS quote_count
"""


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
    }


def _rfq_row_to_dict(row) -> dict:
    return {
        "id": row[0],
        "item_name": row[1],
        "material_spec": row[2],
        "quantity": row[3],
        "delivery_expectation": row[4],
        "notes": row[5],
        "created_at": row[6],
        "updated_at": row[7],
        "quote_count": row[8],
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


@router.post("/api/rfq/{rfq_id}/quotes", status_code=201, response_model=QuoteResponse)
def add_quote(rfq_id: UUID, body: QuoteCreate, db: PgConnection = Depends(get_db)):
    rfq = _get_rfq_or_404(db, rfq_id)

    with db.cursor() as cur:
        cur.execute(
            """
            INSERT INTO supplier_quote
                (rfq_id, supplier_name, unit_price, currency, lead_time_days, payment_terms, remarks, source)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'manual')
            RETURNING id, rfq_id, supplier_name, unit_price, currency,
                      lead_time_days, payment_terms, remarks, source, created_at
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
    enriched, _ = enrich_quotes(all_quotes, rfq["quantity"], rfq.get("delivery_expectation"))

    new_id = new_row[0]
    enriched_new = next(q for q in enriched if q["id"] == new_id)
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
    enriched, best_quote_id = enrich_quotes(quotes, rfq["quantity"], rfq.get("delivery_expectation"))

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


@router.delete("/api/quote/{quote_id}", status_code=204)
def delete_quote(quote_id: UUID, db: PgConnection = Depends(get_db)):
    with db.cursor() as cur:
        cur.execute(
            "DELETE FROM supplier_quote WHERE id = %s RETURNING id",
            (str(quote_id),),
        )
        deleted = cur.fetchone()
        db.commit()
    if deleted is None:
        raise HTTPException(status_code=404, detail="Quote not found")

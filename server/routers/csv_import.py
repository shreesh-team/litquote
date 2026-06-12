from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, File
from psycopg2.extensions import connection as PgConnection

from db.connection import get_db
from models.quote import QuoteResponse
from services import csv_parser
from services.comparison import enrich_quotes
from routers.quotes import _get_rfq_or_404, _quote_row_to_dict, _QUOTE_COLS

router = APIRouter(tags=["quotes"])

_MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


@router.post("/api/rfq/{rfq_id}/quotes/import")
def import_csv(
    rfq_id: UUID,
    file: UploadFile = File(...),
    mode: str = Form("append"),
    db: PgConnection = Depends(get_db),
):
    if mode not in ("append", "replace"):
        raise HTTPException(status_code=400, detail="mode must be 'append' or 'replace'.")

    rfq = _get_rfq_or_404(db, rfq_id)
    from routers.quotes import _check_rfq_mutable
    _check_rfq_mutable(rfq)

    content = file.file.read()
    if len(content) > _MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds the 5 MB size limit.")

    try:
        valid_rows, errors = csv_parser.parse(content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    rows_to_insert: list[dict] = []

    if mode == "replace":
        # All valid rows are inserted; no dedup check against existing quotes
        rows_to_insert = valid_rows
    else:
        # Append: skip rows that already exist in the DB
        with db.cursor() as cur:
            cur.execute(
                "SELECT supplier_name, unit_price, currency FROM supplier_quote WHERE rfq_id = %s",
                (str(rfq_id),),
            )
            existing = {(row[0], row[1], row[2]) for row in cur.fetchall()}

        for row in valid_rows:
            key = (row["supplier_name"], row["unit_price"], row["currency"])
            if key in existing:
                errors.append({
                    "row": row["_row"],
                    "column": "supplier_name",
                    "value": row["supplier_name"],
                    "message": f"a quote from '{row['supplier_name']}' with price {row['unit_price']} {row['currency']} already exists for this RFQ",
                })
            else:
                rows_to_insert.append(row)
                existing.add(key)

    inserted_ids: list = []

    with db.cursor() as cur:
        if mode == "replace":
            cur.execute("DELETE FROM supplier_quote WHERE rfq_id = %s", (str(rfq_id),))

        for row in rows_to_insert:
            cur.execute(
                """
                INSERT INTO supplier_quote
                    (rfq_id, supplier_name, unit_price, currency, lead_time_days, payment_terms, remarks, source)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 'csv')
                RETURNING id, rfq_id, supplier_name, unit_price, currency,
                          lead_time_days, payment_terms, remarks, source, created_at, updated_at
                """,
                (
                    str(rfq_id),
                    row["supplier_name"],
                    row["unit_price"],
                    row["currency"],
                    row["lead_time_days"],
                    row["payment_terms"],
                    row["remarks"],
                ),
            )
            new_row = cur.fetchone()
            inserted_ids.append(new_row[0])

        cur.execute(
            f"SELECT {_QUOTE_COLS} FROM supplier_quote q WHERE q.rfq_id = %s",
            (str(rfq_id),),
        )
        all_rows = cur.fetchall()
        db.commit()

    all_quotes = [_quote_row_to_dict(r) for r in all_rows]
    enriched, _ = enrich_quotes(all_quotes, rfq["quantity"], rfq.get("delivery_expectation"))

    inserted_set = set(inserted_ids)
    new_quotes = [QuoteResponse(**q) for q in enriched if q["id"] in inserted_set]

    return {
        "imported": len(rows_to_insert),
        "failed": len(errors),
        "errors": errors,
        "quotes": [q.model_dump() for q in new_quotes],
    }

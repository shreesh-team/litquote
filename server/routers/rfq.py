from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from psycopg2.extensions import connection as PgConnection
from db.connection import get_db
from models.rfq import RFQCreate, RFQUpdate, RFQResponse, RFQListResponse

router = APIRouter(prefix="/api/rfq", tags=["rfq"])

_RFQ_COLS = """
    r.id, r.item_name, r.material_spec, r.quantity, r.delivery_expectation,
    r.notes, r.status, r.awarded_quote_id, r.created_at, r.updated_at,
    COALESCE((SELECT COUNT(*) FROM supplier_quote q WHERE q.rfq_id = r.id), 0)::int AS quote_count
"""


def _row_to_dict(row) -> dict:
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


@router.post("", status_code=201, response_model=RFQResponse)
def create_rfq(body: RFQCreate, db: PgConnection = Depends(get_db)):
    with db.cursor() as cur:
        cur.execute(
            """
            INSERT INTO rfq (item_name, material_spec, quantity, delivery_expectation, notes)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, item_name, material_spec, quantity, delivery_expectation,
                      notes, status, awarded_quote_id, created_at, updated_at
            """,
            (
                body.item_name,
                body.material_spec,
                body.quantity,
                body.delivery_expectation,
                body.notes,
            ),
        )
        row = cur.fetchone()
        db.commit()
    return RFQResponse(
        id=row[0],
        item_name=row[1],
        material_spec=row[2],
        quantity=row[3],
        delivery_expectation=row[4],
        notes=row[5],
        status=row[6],
        awarded_quote_id=row[7],
        created_at=row[8],
        updated_at=row[9],
        quote_count=0,
    )


@router.get("", response_model=RFQListResponse)
def list_rfqs(
    limit: int = 20,
    offset: int = 0,
    search: str | None = None,
    db: PgConnection = Depends(get_db),
):
    with db.cursor() as cur:
        if search:
            pattern = f"%{search}%"
            cur.execute("SELECT COUNT(*) FROM rfq WHERE item_name ILIKE %s", (pattern,))
            total = cur.fetchone()[0]
            cur.execute(
                f"SELECT {_RFQ_COLS} FROM rfq r WHERE r.item_name ILIKE %s ORDER BY r.created_at DESC LIMIT %s OFFSET %s",
                (pattern, limit, offset),
            )
        else:
            cur.execute("SELECT COUNT(*) FROM rfq")
            total = cur.fetchone()[0]
            cur.execute(
                f"SELECT {_RFQ_COLS} FROM rfq r ORDER BY r.created_at DESC LIMIT %s OFFSET %s",
                (limit, offset),
            )
        rows = cur.fetchall()

    return RFQListResponse(
        items=[RFQResponse(**_row_to_dict(r)) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{rfq_id}", response_model=RFQResponse)
def get_rfq(rfq_id: UUID, db: PgConnection = Depends(get_db)):
    with db.cursor() as cur:
        cur.execute(
            f"SELECT {_RFQ_COLS} FROM rfq r WHERE r.id = %s",
            (str(rfq_id),),
        )
        row = cur.fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="RFQ not found")
    return RFQResponse(**_row_to_dict(row))


@router.put("/{rfq_id}", response_model=RFQResponse)
def update_rfq(rfq_id: UUID, body: RFQUpdate, db: PgConnection = Depends(get_db)):
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        return get_rfq(rfq_id, db)

    with db.cursor() as cur:
        cur.execute("SELECT status FROM rfq WHERE id = %s", (str(rfq_id),))
        status_row = cur.fetchone()
    if status_row is None:
        raise HTTPException(status_code=404, detail="RFQ not found")

    if status_row[0] != "open":
        raise HTTPException(
            status_code=409,
            detail="Only open RFQs can be edited.",
        )

    set_parts = [f"{k} = %s" for k in updates]
    set_parts.append("updated_at = now()")
    params = list(updates.values()) + [str(rfq_id)]

    with db.cursor() as cur:
        cur.execute(
            f"UPDATE rfq SET {', '.join(set_parts)} WHERE id = %s RETURNING id",
            params,
        )
        updated = cur.fetchone()
        db.commit()

    if updated is None:
        raise HTTPException(status_code=404, detail="RFQ not found")

    return get_rfq(rfq_id, db)


@router.post("/{rfq_id}/void", response_model=RFQResponse)
def void_rfq(rfq_id: UUID, db: PgConnection = Depends(get_db)):
    with db.cursor() as cur:
        cur.execute(
            "UPDATE rfq SET status = 'void', updated_at = now() WHERE id = %s RETURNING id",
            (str(rfq_id),),
        )
        updated = cur.fetchone()
        db.commit()
    if updated is None:
        raise HTTPException(status_code=404, detail="RFQ not found")
    return get_rfq(rfq_id, db)


@router.delete("/{rfq_id}", status_code=204)
def delete_rfq(rfq_id: UUID, db: PgConnection = Depends(get_db)):
    with db.cursor() as cur:
        cur.execute("DELETE FROM rfq WHERE id = %s RETURNING id", (str(rfq_id),))
        deleted = cur.fetchone()
        db.commit()

    if deleted is None:
        raise HTTPException(status_code=404, detail="RFQ not found")

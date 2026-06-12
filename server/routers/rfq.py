from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from psycopg2.extensions import connection as PgConnection
from db.connection import get_db
from models.rfq import RFQCreate, RFQResponse, RFQListResponse

router = APIRouter(prefix="/api/rfq", tags=["rfq"])

_RFQ_COLS = """
    r.id, r.item_name, r.material_spec, r.quantity, r.delivery_expectation,
    r.notes, r.created_at, r.updated_at,
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
        "created_at": row[6],
        "updated_at": row[7],
        "quote_count": row[8],
    }


@router.post("", status_code=201, response_model=RFQResponse)
def create_rfq(body: RFQCreate, db: PgConnection = Depends(get_db)):
    with db.cursor() as cur:
        cur.execute(
            """
            INSERT INTO rfq (item_name, material_spec, quantity, delivery_expectation, notes)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, item_name, material_spec, quantity, delivery_expectation,
                      notes, created_at, updated_at
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
        created_at=row[6],
        updated_at=row[7],
        quote_count=0,
    )


@router.get("", response_model=RFQListResponse)
def list_rfqs(
    limit: int = 20,
    offset: int = 0,
    db: PgConnection = Depends(get_db),
):
    with db.cursor() as cur:
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


@router.delete("/{rfq_id}", status_code=204)
def delete_rfq(rfq_id: UUID, db: PgConnection = Depends(get_db)):
    with db.cursor() as cur:
        cur.execute("DELETE FROM rfq WHERE id = %s RETURNING id", (str(rfq_id),))
        deleted = cur.fetchone()
        db.commit()

    if deleted is None:
        raise HTTPException(status_code=404, detail="RFQ not found")

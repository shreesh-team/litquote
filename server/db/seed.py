import os
from datetime import date, timedelta
from db.connection import get_pool

_RFQS = [
    {
        "item_name": "Stainless Steel Rods 304",
        "material_spec": "ASTM A276, 25mm diameter, 3m length",
        "quantity": "500",
        "delivery_expectation": date.today() + timedelta(days=45),
        "notes": "Surface finish Ra 1.6 required",
        "status": "open",
        "quotes": [
            ("Acme Metals", "12.75", "USD", 14, "Net 30", "Includes shipping"),
            ("Global Steel", "11.50", "USD", 21, "Net 45", "FOB origin"),
            ("Pacific Supplies", "13.20", "USD", 7, "COD", "Express delivery available"),
        ],
    },
    {
        "item_name": "Aluminium Sheet 6061-T6",
        "material_spec": "3mm thickness, 1220×2440mm panels",
        "quantity": "200",
        "delivery_expectation": date.today() + timedelta(days=30),
        "notes": "Mill finish acceptable",
        "status": "awarded",
        "awarded_supplier": "Nordic Aluminium",
        "quotes": [
            ("Nordic Aluminium", "48.00", "EUR", 18, "Net 30", "DDP Incoterms"),
            ("Apex Alloys", "51.50", "USD", 10, "Net 30", "Price valid 30 days"),
            ("Ironclad Traders", "49.80", "USD", 14, "Net 45", "Includes insurance"),
        ],
    },
    {
        "item_name": "Carbon Steel Plates A36",
        "material_spec": "10mm thickness, hot-rolled",
        "quantity": "1000",
        "delivery_expectation": date.today() + timedelta(days=60),
        "notes": "Mill test certificates required",
        "status": "open",
        "quotes": [
            ("SteelWorks Co", "8.90", "USD", 35, "Net 60", "FOB warehouse"),
            ("Delta Procurement", "9.40", "USD", 20, "Net 45", "Regional distributor"),
            ("Fortis Materials", "8.20", "USD", 30, "Net 60", "Minimum order 500 units"),
            ("Vanguard Steel", "9.10", "USD", 25, "Net 45", "FOB port of origin"),
        ],
    },
    {
        "item_name": "Copper Pipe 15mm",
        "material_spec": "BS EN 1057, Type R250, 3m lengths",
        "quantity": "300",
        "delivery_expectation": date.today() + timedelta(days=21),
        "notes": None,
        "status": "void",
        "quotes": [
            ("Redwood Alloys", "6.30", "USD", 15, "Net 30", "Anti-corrosion coated"),
            ("Coastline Trading", "6.80", "USD", 8, "Net 30", "Includes customs clearance"),
        ],
    },
    {
        "item_name": "Hex Bolts M12×50 Grade 8.8",
        "material_spec": "DIN 933, zinc-plated, box of 100",
        "quantity": "150",
        "delivery_expectation": date.today() + timedelta(days=14),
        "notes": "Certificate of conformity required",
        "status": "open",
        "quotes": [
            ("Pinnacle Metals", "18.50", "USD", 7, "Net 30", "ISO 9001 certified"),
            ("Harbourview Steel", "16.00", "USD", 12, "Net 90", "Requires 50% upfront"),
            ("CrestLine Inc", "17.40", "USD", 10, "Net 30", "Surface treated"),
            ("BlueRidge Supply", "16.90", "USD", 9, "COD", None),
        ],
    },
    {
        "item_name": "HDPE Pipe DN100",
        "material_spec": "PE100, PN16, 6m lengths, ISO 4427",
        "quantity": "80",
        "delivery_expectation": date.today() + timedelta(days=28),
        "notes": "Fusion welding fittings required as separate line",
        "status": "awarded",
        "awarded_supplier": "Summit Fabricators",
        "quotes": [
            ("Summit Fabricators", "210.00", "USD", 14, "Net 30", "Premium grade"),
            ("Orion Resources", "198.00", "EUR", 21, "Net 30", "Ex-works pricing"),
            ("Meridian Metals", "225.00", "USD", 7, "Net 15", "Express dispatch"),
        ],
    },
    {
        "item_name": "Industrial Ball Bearings 6205",
        "material_spec": "SKF or equivalent, C3 clearance, 2Z sealed",
        "quantity": "400",
        "delivery_expectation": None,
        "notes": "OEM approved brands only",
        "status": "open",
        "quotes": [
            ("Eastgate Supply", "4.20", "USD", 5, "COD", "Same-week dispatch"),
            ("Titan Industrial", "3.90", "USD", 28, "Net 60", "Bulk discount applied"),
            ("Apex Alloys", "4.50", "USD", 10, "Net 30", None),
        ],
    },
    {
        "item_name": "Epoxy Resin 5kg Kit",
        "material_spec": "Bisphenol-A based, Shore D 80, UV resistant",
        "quantity": "60",
        "delivery_expectation": date.today() + timedelta(days=20),
        "notes": "SDS documents required on delivery",
        "status": "open",
        "quotes": [
            ("ChemSource Ltd", "95.00", "USD", 10, "Net 30", "Hazmat surcharge included"),
            ("ProCoat Supplies", "88.50", "USD", 15, "Net 45", None),
            ("Resin Direct", "102.00", "USD", 5, "COD", "Fast dispatch"),
        ],
    },
    {
        "item_name": "Mild Steel Angle 50×50×5mm",
        "material_spec": "EN 10056-1, hot-rolled, 6m lengths",
        "quantity": "250",
        "delivery_expectation": date.today() + timedelta(days=35),
        "notes": None,
        "status": "open",
        "quotes": [
            ("Global Steel", "14.80", "USD", 18, "Net 45", "FOB origin"),
            ("SteelWorks Co", "13.50", "USD", 25, "Net 60", "FOB warehouse"),
            ("Fortis Materials", "14.20", "USD", 20, "Net 60", "Min order 100 units"),
        ],
    },
    {
        "item_name": "Rubber Gaskets 150mm PN16",
        "material_spec": "EPDM, Shore A 70, EN 1514-1",
        "quantity": "500",
        "delivery_expectation": date.today() + timedelta(days=18),
        "notes": "Colour coding by pressure rating preferred",
        "status": "void",
        "quotes": [
            ("SealTech Co", "1.80", "USD", 12, "Net 30", None),
            ("FlexSeal Ltd", "2.10", "USD", 7, "COD", "Stocked item"),
        ],
    },
    {
        "item_name": "3-Phase Motor 7.5kW IE3",
        "material_spec": "IEC 60034, foot mount B3, IP55, 400V 50Hz",
        "quantity": "10",
        "delivery_expectation": date.today() + timedelta(days=42),
        "notes": "VSD compatible, provide efficiency test sheets",
        "status": "awarded",
        "awarded_supplier": "ElectroMotion",
        "quotes": [
            ("ElectroMotion", "1240.00", "USD", 21, "Net 30", "IE3 certified"),
            ("PowerDrive Ltd", "1380.00", "USD", 14, "Net 15", "Ex-stock"),
            ("MechElect Supply", "1195.00", "USD", 35, "Net 60", "Import lead time applies"),
        ],
    },
    {
        "item_name": "Welding Wire ER70S-6 1.2mm",
        "material_spec": "AWS A5.18, 15kg spool, copper-coated",
        "quantity": "120",
        "delivery_expectation": date.today() + timedelta(days=10),
        "notes": "Batch certification required",
        "status": "open",
        "quotes": [
            ("Pinnacle Metals", "38.00", "USD", 7, "Net 30", "ISO 9001 certified"),
            ("Vanguard Steel", "35.50", "USD", 12, "Net 45", None),
            ("Acme Metals", "36.80", "USD", 9, "Net 30", "Includes shipping"),
            ("BlueRidge Supply", "37.20", "USD", 6, "COD", None),
        ],
    },
]


def _find_awarded_quote_id(cur, rfq_id: str, awarded_supplier: str) -> str | None:
    cur.execute(
        "SELECT id FROM supplier_quote WHERE rfq_id = %s AND supplier_name = %s LIMIT 1",
        (rfq_id, awarded_supplier),
    )
    row = cur.fetchone()
    return str(row[0]) if row else None


def run_seed():
    if os.environ.get("SEED_DB", "false").lower() != "true":
        return

    conn = get_pool().getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM rfq")
            if cur.fetchone()[0] > 0:
                print("DB seed: data already present, skipping")
                return

        with conn.cursor() as cur:
            for rfq in _RFQS:
                cur.execute(
                    """
                    INSERT INTO rfq (item_name, material_spec, quantity, delivery_expectation, notes)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (rfq["item_name"], rfq["material_spec"], rfq["quantity"],
                     rfq.get("delivery_expectation"), rfq.get("notes")),
                )
                rfq_id = str(cur.fetchone()[0])

                for supplier, price, currency, lead, terms, remarks in rfq["quotes"]:
                    cur.execute(
                        """
                        INSERT INTO supplier_quote
                            (rfq_id, supplier_name, unit_price, currency, lead_time_days, payment_terms, remarks, source)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, 'manual')
                        """,
                        (rfq_id, supplier, price, currency, lead, terms, remarks),
                    )

                if rfq["status"] in ("awarded", "void"):
                    awarded_id = None
                    if rfq["status"] == "awarded":
                        awarded_id = _find_awarded_quote_id(cur, rfq_id, rfq["awarded_supplier"])
                    cur.execute(
                        "UPDATE rfq SET status = %s, awarded_quote_id = %s, updated_at = now() WHERE id = %s",
                        (rfq["status"], awarded_id, rfq_id),
                    )

            conn.commit()
            print(f"DB seed: {len(_RFQS)} RFQs inserted")
    finally:
        get_pool().putconn(conn)

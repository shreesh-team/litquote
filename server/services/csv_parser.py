import csv
import io
from decimal import Decimal, InvalidOperation

_ALIASES: dict[str, list[str]] = {
    "supplier_name": ["supplier", "vendor", "vendor_name", "company"],
    "unit_price": ["price", "unit_cost", "cost"],
    "currency": ["currency_code", "curr"],
    "lead_time_days": ["lead_time", "lead_days", "days"],
    "payment_terms": ["terms", "payment"],
    "remarks": ["notes", "comment", "comments"],
}

# reverse map: alias (lowercase) -> canonical name
_ALIAS_MAP: dict[str, str] = {}
for canonical, aliases in _ALIASES.items():
    _ALIAS_MAP[canonical] = canonical
    for alias in aliases:
        _ALIAS_MAP[alias] = canonical


def _normalize_headers(raw_headers: list[str]) -> dict[int, str]:
    """Return {col_index: canonical_name} for recognized columns."""
    result = {}
    for i, h in enumerate(raw_headers):
        canonical = _ALIAS_MAP.get(h.strip().lower())
        if canonical:
            result[i] = canonical
    return result


def _validate_row(row_num: int, row_data: dict[str, str]) -> tuple[dict | None, list[dict]]:
    errors: list[dict] = []

    def err(column: str, value: str, message: str):
        errors.append({"row": row_num, "column": column, "value": value, "message": message})

    supplier_name = row_data.get("supplier_name", "").strip()
    unit_price_raw = row_data.get("unit_price", "").strip()
    currency_raw = row_data.get("currency", "").strip()
    lead_time_raw = row_data.get("lead_time_days", "").strip()
    payment_terms = row_data.get("payment_terms", "").strip()
    remarks = row_data.get("remarks", "").strip()

    # supplier_name
    if not supplier_name:
        err("supplier_name", supplier_name, "supplier_name is required")
    elif len(supplier_name) > 255:
        err("supplier_name", supplier_name[:50] + "...", "supplier_name exceeds 255 characters")
        supplier_name = None

    # unit_price
    unit_price = None
    if not unit_price_raw:
        err("unit_price", unit_price_raw, "unit_price must be a non-negative number")
    else:
        try:
            unit_price = Decimal(unit_price_raw)
            if unit_price < 0:
                err("unit_price", unit_price_raw, "unit_price must be a non-negative number")
                unit_price = None
        except InvalidOperation:
            err("unit_price", unit_price_raw, "unit_price must be a non-negative number")

    # currency (optional; default USD; coerce to uppercase)
    currency = None
    if not currency_raw:
        currency = "USD"
    else:
        currency = currency_raw.upper()
        if len(currency) != 3 or not currency.isalpha():
            err("currency", currency_raw, "currency must be a 3-letter ISO code (e.g., USD, EUR)")
            currency = None

    # lead_time_days (optional)
    lead_time_days = None
    if lead_time_raw:
        try:
            lead_time_days = int(lead_time_raw)
            if lead_time_days < 0:
                err("lead_time_days", lead_time_raw, "lead_time_days must be a non-negative integer")
                lead_time_days = None
        except ValueError:
            err("lead_time_days", lead_time_raw, "lead_time_days must be a non-negative integer")

    # payment_terms (optional, max 255)
    if len(payment_terms) > 255:
        err("payment_terms", payment_terms[:50] + "...", "payment_terms exceeds 255 characters")
        payment_terms = None

    if errors:
        return None, errors

    return {
        "supplier_name": supplier_name,
        "unit_price": unit_price,
        "currency": currency,
        "lead_time_days": lead_time_days,
        "payment_terms": payment_terms or None,
        "remarks": remarks or None,
    }, []


def parse(content: bytes) -> tuple[list[dict], list[dict]]:
    """
    Parse CSV bytes into (valid_rows, errors).
    Raises ValueError for file-level problems (missing required columns, no data rows).
    """
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.reader(io.StringIO(text))
    try:
        raw_headers = next(reader)
    except StopIteration:
        raise ValueError("The CSV file contains no data rows.")

    col_map = _normalize_headers(raw_headers)

    # Check required columns
    canonical_names = set(col_map.values())
    if "supplier_name" not in canonical_names:
        raise ValueError("Required column 'supplier_name' is missing.")
    if "unit_price" not in canonical_names:
        raise ValueError("Required column 'unit_price' is missing.")

    valid_rows: list[dict] = []
    errors: list[dict] = []
    data_row_num = 0
    seen: set[tuple] = set()

    for raw_row in reader:
        # Skip fully blank rows
        if not any(cell.strip() for cell in raw_row):
            continue
        data_row_num += 1

        row_data = {}
        for col_idx, canonical in col_map.items():
            row_data[canonical] = raw_row[col_idx] if col_idx < len(raw_row) else ""

        valid_row, row_errors = _validate_row(data_row_num, row_data)
        if row_errors:
            errors.extend(row_errors)
        else:
            dedup_key = (valid_row["supplier_name"], valid_row["unit_price"], valid_row["currency"])
            if dedup_key in seen:
                # silently skip within-file duplicates — treat as one
                pass
            else:
                seen.add(dedup_key)
                valid_rows.append({**valid_row, "_row": data_row_num})

    if data_row_num == 0:
        raise ValueError("The CSV file contains no data rows.")

    return valid_rows, errors

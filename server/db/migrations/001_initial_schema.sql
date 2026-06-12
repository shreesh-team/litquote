CREATE TABLE IF NOT EXISTS rfq (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    item_name            VARCHAR(255) NOT NULL,
    material_spec        TEXT,
    quantity             NUMERIC(15, 4) NOT NULL CHECK (quantity > 0),
    delivery_expectation DATE,
    notes                TEXT,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rfq_created_at ON rfq(created_at DESC);

CREATE TABLE IF NOT EXISTS supplier_quote (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id         UUID         NOT NULL REFERENCES rfq(id) ON DELETE CASCADE,
    supplier_name  VARCHAR(255) NOT NULL,
    unit_price     NUMERIC(15, 4) NOT NULL CHECK (unit_price >= 0),
    currency       CHAR(3)      NOT NULL DEFAULT 'USD',
    lead_time_days INTEGER      CHECK (lead_time_days >= 0),
    payment_terms  VARCHAR(255),
    remarks        TEXT,
    source         VARCHAR(20)  NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'csv')),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_supplier_quote_rfq_id ON supplier_quote(rfq_id);

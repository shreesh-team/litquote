ALTER TABLE supplier_quote
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE supplier_quote
  ADD CONSTRAINT uq_supplier_quote_per_rfq
  UNIQUE (rfq_id, supplier_name, unit_price, currency);

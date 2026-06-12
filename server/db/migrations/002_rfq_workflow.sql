ALTER TABLE rfq
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'awarded', 'cancelled')),
  ADD COLUMN awarded_quote_id UUID REFERENCES supplier_quote(id) ON DELETE SET NULL;

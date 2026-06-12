-- Replace 'cancelled' with 'void' in the status constraint
DO $$
DECLARE
    cname text;
BEGIN
    SELECT conname INTO cname
    FROM pg_constraint
    WHERE conrelid = 'rfq'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%';
    IF cname IS NOT NULL THEN
        EXECUTE 'ALTER TABLE rfq DROP CONSTRAINT ' || quote_ident(cname);
    END IF;
END $$;

UPDATE rfq SET status = 'void' WHERE status = 'cancelled';

ALTER TABLE rfq ADD CONSTRAINT rfq_status_check
    CHECK (status IN ('open', 'awarded', 'void'));

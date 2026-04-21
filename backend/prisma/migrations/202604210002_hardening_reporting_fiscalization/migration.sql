DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fiscal_status') THEN
    CREATE TYPE fiscal_status AS ENUM ('DRAFT', 'PENDING', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'FAILED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fiscal_mode') THEN
    CREATE TYPE fiscal_mode AS ENUM ('DISABLED', 'SANDBOX', 'LIVE');
  END IF;
END $$;

ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS payment_status payment_status NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN IF NOT EXISTS amount_paid numeric(18,2) NOT NULL DEFAULT 0;

ALTER TABLE sales_invoices
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS payment_status payment_status NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN IF NOT EXISTS amount_paid numeric(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fiscal_status fiscal_status NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS fiscalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS fiscal_error varchar(255);

ALTER TABLE sales_returns
  ADD COLUMN IF NOT EXISTS fiscal_status fiscal_status NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS fiscalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS fiscal_error varchar(255);

ALTER TABLE "company_profile"
  ADD COLUMN IF NOT EXISTS "fiscal_mode" fiscal_mode NOT NULL DEFAULT 'DISABLED',
  ADD COLUMN IF NOT EXISTS "fiscal_business_unit" varchar(100),
  ADD COLUMN IF NOT EXISTS "fiscal_operator_code" varchar(100),
  ADD COLUMN IF NOT EXISTS "fiscal_device_id" varchar(100);

UPDATE purchase_invoices
SET payment_status = 'UNPAID', amount_paid = 0
WHERE payment_status IS NULL OR amount_paid IS NULL;

UPDATE sales_invoices
SET payment_status = 'UNPAID',
    amount_paid = 0,
    fiscal_status = 'DRAFT'
WHERE payment_status IS NULL OR amount_paid IS NULL OR fiscal_status IS NULL;

UPDATE sales_returns
SET fiscal_status = 'DRAFT'
WHERE fiscal_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_payment_status ON purchase_invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_payment_status ON sales_invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_fiscal_status ON sales_invoices(fiscal_status);
CREATE INDEX IF NOT EXISTS idx_sales_returns_fiscal_status ON sales_returns(fiscal_status);

ALTER TABLE sales_invoices
  ADD COLUMN IF NOT EXISTS fiscal_reference varchar(150);

ALTER TABLE sales_returns
  ADD COLUMN IF NOT EXISTS fiscal_reference varchar(150);

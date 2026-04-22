DO $$
BEGIN
  CREATE TYPE finance_settlement_type AS ENUM ('RECEIPT', 'PAYMENT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE finance_settlement_status AS ENUM ('OPEN', 'PARTIALLY_ALLOCATED', 'FULLY_ALLOCATED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS finance_settlements (
  id uuid PRIMARY KEY,
  entry_type finance_settlement_type NOT NULL,
  status finance_settlement_status NOT NULL DEFAULT 'OPEN',
  customer_id uuid NULL REFERENCES customers(id),
  supplier_id uuid NULL REFERENCES suppliers(id),
  source_sales_invoice_id uuid NULL REFERENCES sales_invoices(id),
  source_purchase_invoice_id uuid NULL REFERENCES purchase_invoices(id),
  source_audit_log_id uuid NULL,
  entered_amount numeric(18, 2) NOT NULL,
  source_applied_amount numeric(18, 2) NOT NULL,
  unapplied_amount numeric(18, 2) NOT NULL,
  allocated_amount numeric(18, 2) NOT NULL DEFAULT 0,
  remaining_amount numeric(18, 2) NOT NULL,
  paid_at date NOT NULL,
  reference_no varchar(100) NULL,
  notes text NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance_settlement_allocations (
  id uuid PRIMARY KEY,
  settlement_id uuid NOT NULL REFERENCES finance_settlements(id) ON DELETE CASCADE,
  target_sales_invoice_id uuid NULL REFERENCES sales_invoices(id),
  target_purchase_invoice_id uuid NULL REFERENCES purchase_invoices(id),
  amount numeric(18, 2) NOT NULL,
  allocated_at date NOT NULL,
  notes text NULL,
  amount_paid_before numeric(18, 2) NOT NULL,
  amount_paid_after numeric(18, 2) NOT NULL,
  outstanding_before numeric(18, 2) NOT NULL,
  outstanding_after numeric(18, 2) NOT NULL,
  payment_status_before payment_status NOT NULL,
  payment_status_after payment_status NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS finance_settlements_entry_type_status_idx
  ON finance_settlements(entry_type, status);

CREATE INDEX IF NOT EXISTS finance_settlements_customer_id_idx
  ON finance_settlements(customer_id);

CREATE INDEX IF NOT EXISTS finance_settlements_supplier_id_idx
  ON finance_settlements(supplier_id);

CREATE INDEX IF NOT EXISTS finance_settlements_source_sales_invoice_id_idx
  ON finance_settlements(source_sales_invoice_id);

CREATE INDEX IF NOT EXISTS finance_settlements_source_purchase_invoice_id_idx
  ON finance_settlements(source_purchase_invoice_id);

CREATE INDEX IF NOT EXISTS finance_settlements_created_by_idx
  ON finance_settlements(created_by);

CREATE INDEX IF NOT EXISTS finance_settlement_allocations_settlement_id_idx
  ON finance_settlement_allocations(settlement_id);

CREATE INDEX IF NOT EXISTS finance_settlement_allocations_target_sales_invoice_id_idx
  ON finance_settlement_allocations(target_sales_invoice_id);

CREATE INDEX IF NOT EXISTS finance_settlement_allocations_target_purchase_invoice_id_idx
  ON finance_settlement_allocations(target_purchase_invoice_id);

CREATE INDEX IF NOT EXISTS finance_settlement_allocations_created_by_idx
  ON finance_settlement_allocations(created_by);

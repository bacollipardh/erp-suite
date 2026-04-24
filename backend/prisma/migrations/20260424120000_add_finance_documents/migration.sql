CREATE EXTENSION IF NOT EXISTS "pgcrypto";

INSERT INTO document_series (id, code, document_type, prefix, next_number, is_active, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'FIN-REC', 'CUSTOMER_RECEIPT', 'ARK', 1, true, now(), now()),
  (gen_random_uuid(), 'FIN-PAY', 'SUPPLIER_PAYMENT', 'PAG', 1, true, now(), now())
ON CONFLICT (code) DO NOTHING;

CREATE TABLE customer_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES document_series(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  finance_account_id uuid NOT NULL REFERENCES finance_accounts(id),
  doc_no varchar(50) NOT NULL UNIQUE,
  doc_date date NOT NULL,
  status document_status NOT NULL DEFAULT 'DRAFT',
  entered_amount numeric(18, 2) NOT NULL DEFAULT 0,
  applied_amount numeric(18, 2) NOT NULL DEFAULT 0,
  unapplied_amount numeric(18, 2) NOT NULL DEFAULT 0,
  reference_no varchar(100),
  notes text,
  created_by uuid NOT NULL REFERENCES users(id),
  posted_by uuid REFERENCES users(id),
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE customer_receipt_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_receipt_id uuid NOT NULL REFERENCES customer_receipts(id) ON DELETE CASCADE,
  sales_invoice_id uuid NOT NULL REFERENCES sales_invoices(id),
  amount numeric(18, 2) NOT NULL,
  amount_paid_before numeric(18, 2),
  amount_paid_after numeric(18, 2),
  outstanding_before numeric(18, 2),
  outstanding_after numeric(18, 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_receipt_allocations_amount_positive CHECK (amount > 0),
  CONSTRAINT customer_receipt_allocations_unique_invoice UNIQUE (customer_receipt_id, sales_invoice_id)
);

CREATE INDEX idx_customer_receipts_customer ON customer_receipts(customer_id);
CREATE INDEX idx_customer_receipts_account ON customer_receipts(finance_account_id);
CREATE INDEX idx_customer_receipts_doc_date ON customer_receipts(doc_date);
CREATE INDEX idx_customer_receipt_allocations_invoice ON customer_receipt_allocations(sales_invoice_id);

CREATE TABLE supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES document_series(id),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  finance_account_id uuid NOT NULL REFERENCES finance_accounts(id),
  doc_no varchar(50) NOT NULL UNIQUE,
  doc_date date NOT NULL,
  status document_status NOT NULL DEFAULT 'DRAFT',
  entered_amount numeric(18, 2) NOT NULL DEFAULT 0,
  applied_amount numeric(18, 2) NOT NULL DEFAULT 0,
  unapplied_amount numeric(18, 2) NOT NULL DEFAULT 0,
  reference_no varchar(100),
  notes text,
  created_by uuid NOT NULL REFERENCES users(id),
  posted_by uuid REFERENCES users(id),
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE supplier_payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_payment_id uuid NOT NULL REFERENCES supplier_payments(id) ON DELETE CASCADE,
  purchase_invoice_id uuid NOT NULL REFERENCES purchase_invoices(id),
  amount numeric(18, 2) NOT NULL,
  amount_paid_before numeric(18, 2),
  amount_paid_after numeric(18, 2),
  outstanding_before numeric(18, 2),
  outstanding_after numeric(18, 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_payment_allocations_amount_positive CHECK (amount > 0),
  CONSTRAINT supplier_payment_allocations_unique_invoice UNIQUE (supplier_payment_id, purchase_invoice_id)
);

CREATE INDEX idx_supplier_payments_supplier ON supplier_payments(supplier_id);
CREATE INDEX idx_supplier_payments_account ON supplier_payments(finance_account_id);
CREATE INDEX idx_supplier_payments_doc_date ON supplier_payments(doc_date);
CREATE INDEX idx_supplier_payment_allocations_invoice ON supplier_payment_allocations(purchase_invoice_id);

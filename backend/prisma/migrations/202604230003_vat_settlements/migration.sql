DO $$
BEGIN
  CREATE TYPE vat_settlement_status AS ENUM (
    'SETTLED',
    'PARTIALLY_PAID',
    'PAID',
    'REFUND_DUE',
    'BALANCED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS vat_settlements (
  id uuid PRIMARY KEY,
  financial_period_id uuid NOT NULL UNIQUE REFERENCES financial_periods(id),
  settlement_no varchar(50) NOT NULL UNIQUE,
  settlement_date date NOT NULL,
  due_date date NULL,
  status vat_settlement_status NOT NULL DEFAULT 'SETTLED',
  output_taxable_base numeric(18, 2) NOT NULL,
  output_vat numeric(18, 2) NOT NULL,
  input_taxable_base numeric(18, 2) NOT NULL,
  input_vat numeric(18, 2) NOT NULL,
  net_vat_amount numeric(18, 2) NOT NULL,
  payable_amount numeric(18, 2) NOT NULL,
  receivable_amount numeric(18, 2) NOT NULL,
  paid_amount numeric(18, 2) NOT NULL DEFAULT 0,
  filed_at timestamptz(6) NULL,
  filing_reference_no varchar(100) NULL,
  paid_at timestamptz(6) NULL,
  paid_finance_account_id uuid NULL REFERENCES finance_accounts(id),
  reference_no varchar(100) NULL,
  notes text NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS vat_settlements_status_idx
  ON vat_settlements(status);

CREATE INDEX IF NOT EXISTS vat_settlements_due_date_idx
  ON vat_settlements(due_date);

CREATE INDEX IF NOT EXISTS vat_settlements_created_by_idx
  ON vat_settlements(created_by);

CREATE INDEX IF NOT EXISTS vat_settlements_paid_finance_account_id_idx
  ON vat_settlements(paid_finance_account_id);

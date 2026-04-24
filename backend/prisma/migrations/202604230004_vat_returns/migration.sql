DO $$
BEGIN
  CREATE TYPE vat_return_status AS ENUM (
    'DRAFT',
    'READY',
    'FILED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS vat_returns (
  id uuid PRIMARY KEY,
  vat_settlement_id uuid NOT NULL UNIQUE REFERENCES vat_settlements(id),
  return_no varchar(50) NOT NULL UNIQUE,
  declaration_date date NOT NULL,
  due_date date NULL,
  status vat_return_status NOT NULL DEFAULT 'READY',
  currency_code varchar(10) NOT NULL DEFAULT 'EUR',
  output_taxable_base numeric(18, 2) NOT NULL,
  output_vat numeric(18, 2) NOT NULL,
  input_taxable_base numeric(18, 2) NOT NULL,
  input_vat numeric(18, 2) NOT NULL,
  manual_output_vat numeric(18, 2) NOT NULL DEFAULT 0,
  manual_input_vat numeric(18, 2) NOT NULL DEFAULT 0,
  net_vat_amount numeric(18, 2) NOT NULL,
  payable_amount numeric(18, 2) NOT NULL,
  receivable_amount numeric(18, 2) NOT NULL,
  snapshot jsonb NOT NULL,
  filed_at timestamptz(6) NULL,
  filing_reference_no varchar(100) NULL,
  notes text NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS vat_returns_status_idx
  ON vat_returns(status);

CREATE INDEX IF NOT EXISTS vat_returns_declaration_date_idx
  ON vat_returns(declaration_date);

CREATE INDEX IF NOT EXISTS vat_returns_due_date_idx
  ON vat_returns(due_date);

CREATE INDEX IF NOT EXISTS vat_returns_created_by_idx
  ON vat_returns(created_by);

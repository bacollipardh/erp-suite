DO $$
BEGIN
  CREATE TYPE finance_statement_line_direction AS ENUM ('IN', 'OUT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE finance_statement_line_status AS ENUM ('UNMATCHED', 'PARTIALLY_MATCHED', 'MATCHED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS finance_statement_lines (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES finance_accounts(id),
  direction finance_statement_line_direction NOT NULL,
  status finance_statement_line_status NOT NULL DEFAULT 'UNMATCHED',
  statement_date date NOT NULL,
  value_date date NULL,
  amount numeric(18, 2) NOT NULL,
  matched_amount numeric(18, 2) NOT NULL DEFAULT 0,
  statement_balance numeric(18, 2) NULL,
  reference_no varchar(100) NULL,
  external_id varchar(100) NULL,
  counterparty_name varchar(200) NULL,
  description varchar(255) NULL,
  notes text NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance_statement_matches (
  id uuid PRIMARY KEY,
  statement_line_id uuid NOT NULL REFERENCES finance_statement_lines(id) ON DELETE CASCADE,
  finance_account_transaction_id uuid NOT NULL REFERENCES finance_account_transactions(id),
  amount numeric(18, 2) NOT NULL,
  notes text NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(statement_line_id, finance_account_transaction_id)
);

CREATE INDEX IF NOT EXISTS finance_statement_lines_account_id_statement_date_idx
  ON finance_statement_lines(account_id, statement_date);

CREATE INDEX IF NOT EXISTS finance_statement_lines_status_idx
  ON finance_statement_lines(status);

CREATE INDEX IF NOT EXISTS finance_statement_lines_direction_idx
  ON finance_statement_lines(direction);

CREATE INDEX IF NOT EXISTS finance_statement_lines_external_id_idx
  ON finance_statement_lines(external_id);

CREATE INDEX IF NOT EXISTS finance_statement_matches_statement_line_id_idx
  ON finance_statement_matches(statement_line_id);

CREATE INDEX IF NOT EXISTS finance_statement_matches_transaction_id_idx
  ON finance_statement_matches(finance_account_transaction_id);

CREATE INDEX IF NOT EXISTS finance_statement_matches_created_by_idx
  ON finance_statement_matches(created_by);

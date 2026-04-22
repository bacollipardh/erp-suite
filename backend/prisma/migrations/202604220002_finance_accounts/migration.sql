DO $$
BEGIN
  CREATE TYPE finance_account_type AS ENUM ('CASH', 'BANK');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE finance_account_transaction_type AS ENUM (
    'OPENING',
    'MANUAL_IN',
    'MANUAL_OUT',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'RECEIPT',
    'PAYMENT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS finance_accounts (
  id uuid PRIMARY KEY,
  code varchar(30) NOT NULL UNIQUE,
  name varchar(120) NOT NULL,
  account_type finance_account_type NOT NULL,
  currency_code varchar(10) NOT NULL DEFAULT 'EUR',
  bank_name varchar(120) NULL,
  bank_account_no varchar(80) NULL,
  iban varchar(80) NULL,
  swift_code varchar(30) NULL,
  opening_balance numeric(18, 2) NOT NULL DEFAULT 0,
  current_balance numeric(18, 2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  notes text NULL,
  created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance_account_transactions (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES finance_accounts(id),
  finance_settlement_id uuid NULL REFERENCES finance_settlements(id),
  source_audit_log_id uuid NULL,
  transfer_group_id uuid NULL,
  transaction_type finance_account_transaction_type NOT NULL,
  amount numeric(18, 2) NOT NULL,
  balance_before numeric(18, 2) NOT NULL,
  balance_after numeric(18, 2) NOT NULL,
  transaction_date date NOT NULL,
  reference_no varchar(100) NULL,
  counterparty_name varchar(200) NULL,
  source_document_type varchar(40) NULL,
  source_document_id uuid NULL,
  source_document_no varchar(50) NULL,
  notes text NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS finance_accounts_account_type_is_active_idx
  ON finance_accounts(account_type, is_active);

CREATE INDEX IF NOT EXISTS finance_account_transactions_account_id_transaction_date_idx
  ON finance_account_transactions(account_id, transaction_date);

CREATE INDEX IF NOT EXISTS finance_account_transactions_finance_settlement_id_idx
  ON finance_account_transactions(finance_settlement_id);

CREATE INDEX IF NOT EXISTS finance_account_transactions_source_audit_log_id_idx
  ON finance_account_transactions(source_audit_log_id);

CREATE INDEX IF NOT EXISTS finance_account_transactions_transfer_group_id_idx
  ON finance_account_transactions(transfer_group_id);

CREATE INDEX IF NOT EXISTS finance_account_transactions_created_by_idx
  ON finance_account_transactions(created_by);

CREATE INDEX IF NOT EXISTS finance_account_transactions_source_document_idx
  ON finance_account_transactions(source_document_type, source_document_id);

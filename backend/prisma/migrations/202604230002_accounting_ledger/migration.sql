DO $$
BEGIN
  CREATE TYPE ledger_account_category AS ENUM (
    'ASSET',
    'LIABILITY',
    'EQUITY',
    'REVENUE',
    'CONTRA_REVENUE',
    'EXPENSE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE ledger_account_report_section AS ENUM (
    'CURRENT_ASSET',
    'NON_CURRENT_ASSET',
    'CURRENT_LIABILITY',
    'NON_CURRENT_LIABILITY',
    'EQUITY',
    'REVENUE',
    'CONTRA_REVENUE',
    'COST_OF_SALES',
    'OPERATING_EXPENSE',
    'OTHER_INCOME',
    'OTHER_EXPENSE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE journal_entry_line_side AS ENUM ('DEBIT', 'CREDIT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS ledger_accounts (
  id uuid PRIMARY KEY,
  code varchar(30) NOT NULL UNIQUE,
  name varchar(150) NOT NULL,
  category ledger_account_category NOT NULL,
  report_section ledger_account_report_section NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  allow_manual boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  description varchar(255) NULL,
  parent_id uuid NULL REFERENCES ledger_accounts(id),
  created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ledger_accounts_category_is_active_idx
  ON ledger_accounts(category, is_active);

CREATE INDEX IF NOT EXISTS ledger_accounts_report_section_idx
  ON ledger_accounts(report_section);

CREATE INDEX IF NOT EXISTS ledger_accounts_parent_id_idx
  ON ledger_accounts(parent_id);

ALTER TABLE finance_accounts
  ADD COLUMN IF NOT EXISTS ledger_account_id uuid NULL;

DO $$
BEGIN
  ALTER TABLE finance_accounts
    ADD CONSTRAINT finance_accounts_ledger_account_id_fkey
    FOREIGN KEY (ledger_account_id) REFERENCES ledger_accounts(id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS finance_accounts_ledger_account_id_idx
  ON finance_accounts(ledger_account_id);

CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY,
  entry_no varchar(50) NOT NULL UNIQUE,
  entry_date date NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL,
  description varchar(255) NOT NULL,
  source_type varchar(50) NULL,
  source_id uuid NULL,
  source_no varchar(100) NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS journal_entries_entry_date_idx
  ON journal_entries(entry_date);

CREATE INDEX IF NOT EXISTS journal_entries_year_month_idx
  ON journal_entries(year, month);

CREATE INDEX IF NOT EXISTS journal_entries_source_type_source_id_idx
  ON journal_entries(source_type, source_id);

CREATE INDEX IF NOT EXISTS journal_entries_created_by_idx
  ON journal_entries(created_by);

CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id uuid PRIMARY KEY,
  journal_entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES ledger_accounts(id),
  line_no integer NOT NULL,
  side journal_entry_line_side NOT NULL,
  amount numeric(18, 2) NOT NULL,
  description varchar(255) NULL,
  party_name varchar(200) NULL,
  created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT journal_entry_lines_journal_entry_id_line_no_key UNIQUE (journal_entry_id, line_no)
);

CREATE INDEX IF NOT EXISTS journal_entry_lines_account_id_idx
  ON journal_entry_lines(account_id);

CREATE INDEX IF NOT EXISTS journal_entry_lines_side_idx
  ON journal_entry_lines(side);

DO $$
BEGIN
  CREATE TYPE financial_period_status AS ENUM ('OPEN', 'SOFT_CLOSED', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS financial_periods (
  id uuid PRIMARY KEY,
  year integer NOT NULL,
  month integer NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status financial_period_status NOT NULL DEFAULT 'OPEN',
  closed_at timestamptz(6) NULL,
  closed_by uuid NULL REFERENCES users(id),
  closed_reason varchar(255) NULL,
  reopened_at timestamptz(6) NULL,
  reopened_by uuid NULL REFERENCES users(id),
  reopened_reason varchar(255) NULL,
  created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT financial_periods_year_month_key UNIQUE (year, month)
);

CREATE INDEX IF NOT EXISTS financial_periods_status_idx
  ON financial_periods(status);

CREATE INDEX IF NOT EXISTS financial_periods_period_start_period_end_idx
  ON financial_periods(period_start, period_end);

CREATE INDEX IF NOT EXISTS financial_periods_closed_by_idx
  ON financial_periods(closed_by);

CREATE INDEX IF NOT EXISTS financial_periods_reopened_by_idx
  ON financial_periods(reopened_by);

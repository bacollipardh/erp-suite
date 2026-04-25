CREATE TABLE IF NOT EXISTS approval_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(80) NOT NULL UNIQUE,
  name varchar(160) NOT NULL,
  entity_type varchar(80) NOT NULL,
  action varchar(80) NOT NULL,
  min_amount numeric(18,2) NULL,
  max_amount numeric(18,2) NULL,
  required_steps int NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT approval_policies_required_steps_check CHECK (required_steps BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_approval_policies_entity_action ON approval_policies(entity_type, action, is_active);

CREATE TABLE IF NOT EXISTS approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NULL REFERENCES approval_policies(id),
  entity_type varchar(80) NOT NULL,
  entity_id uuid NULL,
  entity_no varchar(100) NULL,
  action varchar(80) NOT NULL,
  title varchar(180) NOT NULL,
  description text NULL,
  amount numeric(18,2) NOT NULL DEFAULT 0,
  currency_code varchar(10) NOT NULL DEFAULT 'EUR',
  status varchar(30) NOT NULL DEFAULT 'PENDING',
  requested_by_id uuid NOT NULL REFERENCES users(id),
  current_step int NOT NULL DEFAULT 1,
  required_steps int NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT approval_requests_status_check CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  CONSTRAINT approval_requests_required_steps_check CHECK (required_steps BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_entity ON approval_requests(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_requested_by ON approval_requests(requested_by_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_requested_at ON approval_requests(requested_at);

CREATE TABLE IF NOT EXISTS approval_request_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id uuid NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  step_no int NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'PENDING',
  approver_role_code varchar(30) NULL,
  approver_user_id uuid NULL REFERENCES users(id),
  decided_by_id uuid NULL REFERENCES users(id),
  decision_note text NULL,
  decided_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT approval_request_steps_status_check CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED')),
  CONSTRAINT approval_request_steps_step_no_check CHECK (step_no BETWEEN 1 AND 5),
  CONSTRAINT approval_request_steps_unique_step UNIQUE (approval_request_id, step_no)
);

CREATE INDEX IF NOT EXISTS idx_approval_request_steps_request ON approval_request_steps(approval_request_id);
CREATE INDEX IF NOT EXISTS idx_approval_request_steps_status ON approval_request_steps(status);
CREATE INDEX IF NOT EXISTS idx_approval_request_steps_approver_user ON approval_request_steps(approver_user_id);

CREATE TABLE IF NOT EXISTS approval_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id uuid NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  action varchar(40) NOT NULL,
  note text NULL,
  created_by_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT approval_request_events_action_check CHECK (action IN ('REQUESTED', 'APPROVED_STEP', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMMENT'))
);

CREATE INDEX IF NOT EXISTS idx_approval_request_events_request ON approval_request_events(approval_request_id);
CREATE INDEX IF NOT EXISTS idx_approval_request_events_created_at ON approval_request_events(created_at);

INSERT INTO approval_policies (code, name, entity_type, action, min_amount, max_amount, required_steps)
VALUES
  ('SUPPLIER_PAYMENT_POST_500', 'Supplier payment post approval over 500 EUR', 'supplier-payments', 'POST', 500, NULL, 1),
  ('MANUAL_JOURNAL_POST', 'Manual journal entry approval', 'journal-entries', 'POST', NULL, NULL, 1),
  ('SALES_DISCOUNT_OVERRIDE', 'Sales discount override approval', 'sales-invoices', 'DISCOUNT_OVERRIDE', NULL, NULL, 1),
  ('CUSTOMER_CREDIT_OVERRIDE', 'Customer credit override approval', 'customers', 'CREDIT_OVERRIDE', NULL, NULL, 1),
  ('SALES_RETURN_POST', 'Sales return posting approval', 'sales-returns', 'POST', NULL, NULL, 1),
  ('FINANCE_ACCOUNT_TRANSFER', 'Finance account transfer approval', 'finance-accounts', 'TRANSFER', NULL, NULL, 1)
ON CONFLICT (code) DO NOTHING;

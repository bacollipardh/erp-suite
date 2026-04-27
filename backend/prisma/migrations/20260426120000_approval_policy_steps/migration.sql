CREATE TABLE IF NOT EXISTS approval_policy_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES approval_policies(id) ON DELETE CASCADE,
  step_no integer NOT NULL,
  approver_role_code varchar(50),
  approver_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  label varchar(120),
  is_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT approval_policy_steps_step_no_check CHECK (step_no BETWEEN 1 AND 5),
  CONSTRAINT approval_policy_steps_unique_step UNIQUE (policy_id, step_no)
);

CREATE INDEX IF NOT EXISTS approval_policy_steps_policy_idx ON approval_policy_steps(policy_id);
CREATE INDEX IF NOT EXISTS approval_policy_steps_role_idx ON approval_policy_steps(approver_role_code);
CREATE INDEX IF NOT EXISTS approval_policy_steps_user_idx ON approval_policy_steps(approver_user_id);

INSERT INTO approval_policy_steps (policy_id, step_no, approver_role_code, label)
SELECT p.id, s.step_no, NULL, CONCAT('Step ', s.step_no)
FROM approval_policies p
CROSS JOIN LATERAL generate_series(1, GREATEST(1, LEAST(5, p.required_steps))) AS s(step_no)
ON CONFLICT (policy_id, step_no) DO NOTHING;

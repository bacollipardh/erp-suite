-- Add sla_hours (per-policy SLA, default 24h) and auto_approve to policies
ALTER TABLE approval_policies
  ADD COLUMN IF NOT EXISTS sla_hours int NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS auto_approve boolean NOT NULL DEFAULT false;

-- Add escalation tracking to requests
ALTER TABLE approval_requests
  ADD COLUMN IF NOT EXISTS is_escalated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS escalated_by_id uuid NULL REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_approval_requests_escalated ON approval_requests(is_escalated) WHERE is_escalated = true;

-- Extend event actions to include ESCALATED and AUTO_APPROVED
ALTER TABLE approval_request_events
  DROP CONSTRAINT IF EXISTS approval_request_events_action_check;

ALTER TABLE approval_request_events
  ADD CONSTRAINT approval_request_events_action_check
    CHECK (action IN (
      'REQUESTED','APPROVED_STEP','APPROVED','REJECTED',
      'CANCELLED','COMMENT','ESCALATED','AUTO_APPROVED'
    ));

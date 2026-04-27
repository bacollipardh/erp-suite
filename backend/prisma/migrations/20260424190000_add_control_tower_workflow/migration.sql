CREATE TABLE IF NOT EXISTS control_tower_exception_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exception_key text NOT NULL UNIQUE,
  status varchar(30) NOT NULL DEFAULT 'OPEN',
  assigned_to_id uuid NULL REFERENCES users(id),
  snoozed_until timestamptz NULL,
  last_note text NULL,
  resolved_at timestamptz NULL,
  resolved_by_id uuid NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT control_tower_exception_states_status_check CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'SNOOZED', 'RESOLVED'))
);

CREATE INDEX IF NOT EXISTS idx_control_tower_exception_states_status ON control_tower_exception_states(status);
CREATE INDEX IF NOT EXISTS idx_control_tower_exception_states_assigned_to ON control_tower_exception_states(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_control_tower_exception_states_snoozed_until ON control_tower_exception_states(snoozed_until);

CREATE TABLE IF NOT EXISTS control_tower_exception_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exception_state_id uuid NOT NULL REFERENCES control_tower_exception_states(id) ON DELETE CASCADE,
  action varchar(30) NOT NULL,
  note text NULL,
  assigned_to_id uuid NULL REFERENCES users(id),
  snoozed_until timestamptz NULL,
  created_by_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT control_tower_exception_events_action_check CHECK (action IN ('ACKNOWLEDGE', 'START', 'ASSIGN', 'SNOOZE', 'RESOLVE', 'REOPEN', 'NOTE'))
);

CREATE INDEX IF NOT EXISTS idx_control_tower_exception_events_state ON control_tower_exception_events(exception_state_id);
CREATE INDEX IF NOT EXISTS idx_control_tower_exception_events_created_by ON control_tower_exception_events(created_by_id);
CREATE INDEX IF NOT EXISTS idx_control_tower_exception_events_created_at ON control_tower_exception_events(created_at);

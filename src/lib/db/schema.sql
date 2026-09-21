CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  is_agent      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS requests (
  id           TEXT PRIMARY KEY,
  subject      TEXT NOT NULL,
  description  TEXT NOT NULL,
  requester_id TEXT NOT NULL REFERENCES users(id),
  -- Denormalised so the list query can search and render the requester without
  -- joining users. Requester never changes once a request is filed.
  requester_name TEXT NOT NULL,
  category     TEXT NOT NULL,
  priority     TEXT NOT NULL,
  status       TEXT NOT NULL,
  assignee_id  TEXT REFERENCES users(id),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,

  -- Priority and status sort by workflow order, not alphabetically. Storing the
  -- rank lets SQLite satisfy those sorts from an index instead of a CASE scan.
  priority_rank INTEGER GENERATED ALWAYS AS (
    CASE priority WHEN 'URGENT' THEN 4 WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 ELSE 1 END
  ) STORED,
  status_rank INTEGER GENERATED ALWAYS AS (
    CASE status WHEN 'OPEN' THEN 1 WHEN 'IN_PROGRESS' THEN 2 WHEN 'RESOLVED' THEN 3 ELSE 4 END
  ) STORED
);

CREATE TABLE IF NOT EXISTS activity (
  id             TEXT PRIMARY KEY,
  request_id     TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  type           TEXT NOT NULL,
  actor_id       TEXT NOT NULL,
  actor_name     TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  previous_value TEXT,
  new_value      TEXT
);

CREATE INDEX IF NOT EXISTS idx_requests_updated_at    ON requests(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_created_at    ON requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_status        ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_priority      ON requests(priority);
CREATE INDEX IF NOT EXISTS idx_requests_category      ON requests(category);
CREATE INDEX IF NOT EXISTS idx_requests_assignee      ON requests(assignee_id);
CREATE INDEX IF NOT EXISTS idx_requests_priority_rank ON requests(priority_rank DESC);
CREATE INDEX IF NOT EXISTS idx_requests_status_rank   ON requests(status_rank);
CREATE INDEX IF NOT EXISTS idx_requests_subject       ON requests(subject);
CREATE INDEX IF NOT EXISTS idx_requests_requester     ON requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_activity_request       ON activity(request_id, created_at DESC);

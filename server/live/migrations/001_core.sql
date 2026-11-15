CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-HJKMNP-Z]{4}$'),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
CREATE TABLE IF NOT EXISTS transcript_chunks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions(id),
  start_sec double precision NOT NULL CHECK (start_sec >= 0),
  end_sec double precision NOT NULL CHECK (end_sec >= start_sec),
  text text NOT NULL
);
CREATE INDEX IF NOT EXISTS transcript_session_start ON transcript_chunks(session_id, start_sec);
CREATE TABLE IF NOT EXISTS topics (
  session_id uuid NOT NULL REFERENCES sessions(id),
  position integer NOT NULL,
  start_sec double precision NOT NULL,
  end_sec double precision NOT NULL,
  title text NOT NULL,
  PRIMARY KEY(session_id, position)
);
CREATE TABLE IF NOT EXISTS reports (
  session_id uuid PRIMARY KEY REFERENCES sessions(id),
  report jsonb NOT NULL,
  verification jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS events (
  seq bigint GENERATED ALWAYS AS IDENTITY,
  id uuid NOT NULL,
  session_id uuid NOT NULL REFERENCES sessions(id),
  student_id text,
  type text NOT NULL,
  transcript_ts_sec double precision NOT NULL CHECK (transcript_ts_sec >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY(id, created_at)
);
SELECT create_hypertable('events', 'created_at', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS events_session_created ON events(session_id, created_at);

-- Exact DISTINCT aggregates require TimescaleDB >= 2.7 (non-finalized old
-- aggregate format is intentionally not used). Target a current Tiger service.
CREATE MATERIALIZED VIEW IF NOT EXISTS event_counts_10s
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT time_bucket(INTERVAL '10 seconds', created_at) AS bucket,
       session_id, type, count(*) AS event_count,
       count(DISTINCT student_id) AS students
FROM events GROUP BY bucket, session_id, type WITH NO DATA;

SELECT add_continuous_aggregate_policy('event_counts_10s',
  start_offset => INTERVAL '1 day', end_offset => INTERVAL '10 seconds',
  schedule_interval => INTERVAL '5 seconds', if_not_exists => TRUE);

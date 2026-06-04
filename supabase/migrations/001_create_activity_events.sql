-- SharpConnect Activity Events Table
-- Migration: 001_create_activity_events.sql
-- Description: Core operational event tracking for campaign lifecycle

CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGSERIAL PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'system',
  actor_type TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  metadata JSONB DEFAULT '{}',
  version INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_campaign_id ON activity_logs (campaign_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_event_type ON activity_logs (event_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_category ON activity_logs (category);
CREATE INDEX IF NOT EXISTS idx_activity_logs_campaign_created ON activity_logs (campaign_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (from client-side convenience loggers)
CREATE POLICY IF NOT EXISTS "Allow anonymous insert"
  ON activity_logs
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anonymous select
CREATE POLICY IF NOT EXISTS "Allow anonymous select"
  ON activity_logs
  FOR SELECT
  TO anon
  USING (true);

-- Enable realtime for live UI updates
ALTER PUBLICATION supabase_realtime ADD TABLE activity_logs;

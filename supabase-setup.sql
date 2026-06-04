-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/YOUR_PROJECT/sql)
-- Creates the app_data table used by the server API for all collection storage.

CREATE TABLE IF NOT EXISTS app_data (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection, id)
);

-- Index for fast collection queries
CREATE INDEX IF NOT EXISTS idx_app_data_collection ON app_data (collection);
CREATE INDEX IF NOT EXISTS idx_app_data_updated ON app_data (updated_at DESC);

-- Phase 6: Schema cleanup & hardening
-- Migrates REAL→NUMERIC(10,2) for currency columns,
-- adds missing columns to notifications table,
-- and ensures all indexes are in place.

-- ─── 1. Currency columns: REAL → NUMERIC(10,2) ────────────────

ALTER TABLE campaigns
  ALTER COLUMN package_price TYPE NUMERIC(10,2),
  ALTER COLUMN sound_fee TYPE NUMERIC(10,2),
  ALTER COLUMN total TYPE NUMERIC(10,2);

ALTER TABLE payments
  ALTER COLUMN amount TYPE NUMERIC(10,2);

-- ─── 2. Add missing columns to notifications ───────────────────

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS triggered_by TEXT NOT NULL DEFAULT '';

-- ─── 3. Add missing indexes ────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_event_logs_created_at ON event_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_campaign ON notification_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artist_notifications_created_at ON artist_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_settings_single ON automation_settings(id);

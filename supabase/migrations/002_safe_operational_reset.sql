-- SharpConnect Safe Operational Reset
-- Migration: 002_safe_operational_reset.sql
-- Description: Safe DELETE-only cleanup of all operational/test data.
--   Preserves schema, tables, policies, realtime publications, storage buckets,
--   RLS, and configuration data. Does NOT drop or alter any DB objects.
--
-- Execute ONLY when you want a clean production-ready state.
-- This is safe to run multiple times (idempotent when data is empty).

BEGIN;

-- ─── 1. OPERATIONAL TABLES (delete in dependency-safe order) ───

-- Child / leaf tables first (no dependents)
DELETE FROM notification_logs;
DELETE FROM event_logs;
DELETE FROM artist_notifications;
DELETE FROM admin_alerts;

-- Activity tracking
DELETE FROM activity_logs;

-- Media references
DELETE FROM uploads;

-- Financial records
DELETE FROM payments;

-- Notifications (depend on campaign_id text field, but no FK constraint)
DELETE FROM notifications;

-- Config / automation (operational)
DELETE FROM automation_settings;

-- Campaigns last (text-based references to campaign_id from other tables
-- have already been deleted above)
DELETE FROM campaigns;

-- ─── 2. SEQUENCE RESETS (optional — keeps IDs from ballooning) ───

ALTER SEQUENCE IF EXISTS activity_logs_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS campaigns_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS uploads_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS payments_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS notifications_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS event_logs_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS notification_logs_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS admin_alerts_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS artist_notifications_id_seq RESTART WITH 1;

COMMIT;

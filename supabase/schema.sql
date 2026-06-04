-- SharpConnect Template Promo — Supabase Schema
-- Run this in your Supabase SQL Editor to create all tables, storage, and RLS policies.

-- ─── EXTENSIONS ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── TABLES ───────────────────────────────────────────────────

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT UNIQUE NOT NULL,
  artist_name TEXT NOT NULL DEFAULT '',
  song_title TEXT NOT NULL DEFAULT '',
  tiktok_handle TEXT NOT NULL DEFAULT '',
  instagram_handle TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  package_id TEXT NOT NULL DEFAULT '',
  package_name TEXT NOT NULL DEFAULT '',
  package_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  package_name TEXT NOT NULL DEFAULT '',
  sound_option TEXT NOT NULL DEFAULT 'original',
  sound_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  creative_direction TEXT NOT NULL DEFAULT '',
  selected_tags TEXT[] DEFAULT '{}',
  has_audio BOOLEAN DEFAULT FALSE,
  has_video BOOLEAN DEFAULT FALSE,
  sender_name TEXT NOT NULL DEFAULT '',
  sender_number TEXT NOT NULL DEFAULT '',
  amount_sent TEXT NOT NULL DEFAULT '',
  transaction_id TEXT NOT NULL DEFAULT '',
  payment_method TEXT NOT NULL DEFAULT '',
  editor TEXT NOT NULL DEFAULT 'Unassigned',
  priority TEXT NOT NULL DEFAULT 'Medium',
  notes TEXT NOT NULL DEFAULT '',
  payment_status TEXT NOT NULL DEFAULT 'Pending Verification',
  campaign_status TEXT NOT NULL DEFAULT 'Pending Verification',
  audio_url TEXT DEFAULT '',
  video_url TEXT DEFAULT '',
  tiktok_sound_link TEXT DEFAULT '',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
  file_type TEXT NOT NULL,
  file_name TEXT NOT NULL DEFAULT '',
  file_url TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT '',
  telegram_file_id TEXT DEFAULT '',
  telegram_message_id BIGINT DEFAULT NULL,
  upload_source TEXT DEFAULT 'local',
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT '',
  payment_reference TEXT NOT NULL DEFAULT '',
  payment_status TEXT NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'medium',
  triggered_by TEXT NOT NULL DEFAULT '',
  read_status BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE admin_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  campaign_id TEXT NOT NULL DEFAULT '',
  read_status BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE artist_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  read_status BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE event_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL DEFAULT '',
  event_type TEXT NOT NULL DEFAULT '',
  metadata JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'success',
  error TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL DEFAULT '',
  recipient TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE automation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auto_assign_editor BOOLEAN DEFAULT TRUE,
  auto_start_campaign BOOLEAN DEFAULT TRUE,
  send_client_notifications BOOLEAN DEFAULT TRUE,
  send_internal_alerts BOOLEAN DEFAULT TRUE,
  auto_offer_upsell BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default automation settings
INSERT INTO automation_settings (id) VALUES (gen_random_uuid());

-- ─── INDEXES ──────────────────────────────────────────────────
CREATE INDEX idx_campaigns_campaign_id ON campaigns(campaign_id);
CREATE INDEX idx_campaigns_status ON campaigns(campaign_status);
CREATE INDEX idx_campaigns_payment_status ON campaigns(payment_status);
CREATE INDEX idx_campaigns_created_at ON campaigns(created_at DESC);
CREATE INDEX idx_event_logs_campaign ON event_logs(campaign_id);
CREATE INDEX idx_event_logs_type ON event_logs(event_type);
CREATE INDEX idx_notifications_campaign ON notifications(campaign_id);
CREATE INDEX idx_artist_notifications_campaign ON artist_notifications(campaign_id);
CREATE INDEX idx_admin_alerts_read ON admin_alerts(read_status);
CREATE INDEX idx_uploads_campaign ON uploads(campaign_id);
CREATE INDEX idx_uploads_campaign_type ON uploads(campaign_id, file_type);
CREATE INDEX idx_uploads_uploaded_at ON uploads(uploaded_at DESC);
CREATE INDEX idx_payments_campaign ON payments(campaign_id);
CREATE INDEX idx_artist_notifications_read ON artist_notifications(read_status);
CREATE INDEX idx_notifications_read ON notifications(read_status);
CREATE INDEX idx_admin_alerts_campaign ON admin_alerts(campaign_id);


-- ─── UPDATED_AT TRIGGER ───────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER automation_settings_updated_at
  BEFORE UPDATE ON automation_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── STORAGE BUCKETS ─────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('campaign-audio', 'campaign-audio', TRUE),
  ('campaign-reference-videos', 'campaign-reference-videos', TRUE),
  ('campaign-payment-proof', 'campaign-payment-proof', TRUE),
  ('campaign-editor-submissions', 'campaign-editor-submissions', TRUE),
  ('campaign-final-approved', 'campaign-final-approved', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ─── RLS POLICIES ────────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_settings ENABLE ROW LEVEL SECURITY;

-- Campaigns: anyone can insert, read own by campaign_id, admins read all
CREATE POLICY "Anyone can create campaigns"
  ON campaigns FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "Anyone can read campaigns by ID"
  ON campaigns FOR SELECT
  USING (TRUE);

CREATE POLICY "Admins can update campaigns"
  ON campaigns FOR UPDATE
  USING (TRUE);

-- Uploads: anyone can insert, read all
CREATE POLICY "Anyone can upload"
  ON uploads FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "Anyone can read uploads"
  ON uploads FOR SELECT
  USING (TRUE);

-- Payments: anyone can insert, read all
CREATE POLICY "Anyone can insert payments"
  ON payments FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "Anyone can read payments"
  ON payments FOR SELECT
  USING (TRUE);

-- Notifications
CREATE POLICY "Anyone can read notifications"
  ON notifications FOR SELECT
  USING (TRUE);

CREATE POLICY "Anyone can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "Anyone can update notifications"
  ON notifications FOR UPDATE
  USING (TRUE);

-- Admin alerts
CREATE POLICY "Anyone can read admin alerts"
  ON admin_alerts FOR SELECT
  USING (TRUE);

CREATE POLICY "Anyone can insert admin alerts"
  ON admin_alerts FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "Anyone can update admin alerts"
  ON admin_alerts FOR UPDATE
  USING (TRUE);

-- Artist notifications
CREATE POLICY "Anyone can read artist notifications"
  ON artist_notifications FOR SELECT
  USING (TRUE);

CREATE POLICY "Anyone can insert artist notifications"
  ON artist_notifications FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "Anyone can update artist notifications"
  ON artist_notifications FOR UPDATE
  USING (TRUE);

-- Event logs
CREATE POLICY "Anyone can read event logs"
  ON event_logs FOR SELECT
  USING (TRUE);

CREATE POLICY "Anyone can insert event logs"
  ON event_logs FOR INSERT
  WITH CHECK (TRUE);

-- Notification logs
CREATE POLICY "Anyone can read notification logs"
  ON notification_logs FOR SELECT
  USING (TRUE);

CREATE POLICY "Anyone can insert notification logs"
  ON notification_logs FOR INSERT
  WITH CHECK (TRUE);

-- Automation settings
CREATE POLICY "Anyone can read automation settings"
  ON automation_settings FOR SELECT
  USING (TRUE);

CREATE POLICY "Anyone can update automation settings"
  ON automation_settings FOR UPDATE
  USING (TRUE);

-- Storage RLS: allow public reads and inserts
CREATE POLICY "Public read storage"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('campaign-audio', 'campaign-reference-videos', 'campaign-payment-proof', 'campaign-editor-submissions', 'campaign-final-approved'));

CREATE POLICY "Public insert storage"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id IN ('campaign-audio', 'campaign-reference-videos', 'campaign-payment-proof', 'campaign-editor-submissions', 'campaign-final-approved'));

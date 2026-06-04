export interface Json {
  [key: string]: string | number | boolean | null | Json[] | { [key: string]: Json };
}

export interface Database {
  public: {
    Tables: {
      campaigns: {
        Row: CampaignRow;
        Insert: Omit<CampaignRow, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<CampaignRow, "id">>;
      };
      uploads: {
        Row: UploadRow;
        Insert: Omit<UploadRow, "id" | "uploaded_at">;
        Update: Partial<Omit<UploadRow, "id">>;
      };
      payments: {
        Row: PaymentRow;
        Insert: Omit<PaymentRow, "id" | "created_at">;
        Update: Partial<Omit<PaymentRow, "id">>;
      };
      notifications: {
        Row: NotificationRow;
        Insert: Omit<NotificationRow, "id" | "created_at">;
        Update: Partial<Omit<NotificationRow, "id">>;
      };
      artist_notifications: {
        Row: ArtistNotificationRow;
        Insert: Omit<ArtistNotificationRow, "id" | "created_at">;
        Update: Partial<Omit<ArtistNotificationRow, "id">>;
      };
      event_logs: {
        Row: EventLogRow;
        Insert: Omit<EventLogRow, "id" | "created_at">;
        Update: Partial<Omit<EventLogRow, "id">>;
      };
      notification_logs: {
        Row: NotificationLogRow;
        Insert: Omit<NotificationLogRow, "id" | "created_at">;
        Update: Partial<Omit<NotificationLogRow, "id">>;
      };
      automation_settings: {
        Row: AutomationSettingsRow;
        Insert: Omit<AutomationSettingsRow, "id" | "updated_at">;
        Update: Partial<Omit<AutomationSettingsRow, "id">>;
      };
      admin_alerts: {
        Row: AdminAlertRow;
        Insert: Omit<AdminAlertRow, "id" | "created_at">;
        Update: Partial<Omit<AdminAlertRow, "id">>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

export interface CampaignRow {
  id: string;
  campaign_id: string;
  artist_name: string;
  song_title: string;
  tiktok_handle: string;
  instagram_handle: string;
  whatsapp: string;
  email: string;
  package_id: string;
  package_name: string;
  package_price: number;
  sound_option: string;
  sound_fee: number;
  total: number;
  creative_direction: string;
  selected_tags: string[];
  has_audio: boolean;
  has_video: boolean;
  sender_name: string;
  sender_number: string;
  amount_sent: string;
  transaction_id: string;
  payment_method: string;
  editor: string;
  priority: string;
  notes: string;
  payment_status: string;
  campaign_status: string;
  audio_url: string;
  video_url: string;
  tiktok_sound_link: string;
  created_at: string;
  updated_at: string;
}

export interface UploadRow {
  id: string;
  campaign_id: string;
  file_type: string;
  file_name: string;
  file_url: string;
  mime_type: string;
  telegram_file_id: string;
  telegram_message_id: number | null;
  upload_source: string;
  uploaded_at: string;
}

export interface PaymentRow {
  id: string;
  campaign_id: string;
  amount: number;
  payment_method: string;
  payment_reference: string;
  payment_status: string;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  campaign_id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  triggered_by: string;
  read_status: boolean;
  created_at: string;
}

export interface AdminAlertRow {
  id: string;
  type: string;
  message: string;
  campaign_id: string;
  read_status: boolean;
  created_at: string;
}

export interface ArtistNotificationRow {
  id: string;
  campaign_id: string;
  type: string;
  title: string;
  message: string;
  read_status: boolean;
  created_at: string;
}

export interface EventLogRow {
  id: string;
  campaign_id: string;
  event_type: string;
  metadata: Json;
  status: string;
  error: string;
  created_at: string;
}

export interface NotificationLogRow {
  id: string;
  campaign_id: string;
  channel: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
}

export interface AutomationSettingsRow {
  id: string;
  auto_assign_editor: boolean;
  auto_start_campaign: boolean;
  send_client_notifications: boolean;
  send_internal_alerts: boolean;
  auto_offer_upsell: boolean;
  updated_at: string;
}

import { supabase, isSupabaseConfigured } from "./supabase";

export type EventType =
  | "campaign_created"
  | "payment_submitted"
  | "payment_approved"
  | "payment_rejected"
  | "campaign_started"
  | "editing_started"
  | "editor_submitted"
  | "revision_requested"
  | "admin_approved"
  | "template_completed"
  | "campaign_scheduled"
  | "campaign_posted"
  | "campaign_completed"
  | "editor_assigned"
  | "priority_changed"
  | "note_added"
  | "notification_sent"
  | "error"
  | "manual_override"
  | "proof_requested"
  | "artist_review_ready"
  | "artist_approved"
  | "artist_revision_requested"
  | "artist_comment_added";

export interface EventLog {
  id: string;
  campaignId: string;
  type: EventType;
  timestamp: string;
  metadata: Record<string, string>;
  status: "success" | "failed";
  error?: string;
}

// ─── LOCALSTORAGE FALLBACK ────────────────────────────────────

function lsGetLogs(): EventLog[] {
  try {
    const raw = localStorage.getItem("sharpconnect_events");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function lsSetLogs(logs: EventLog[]) {
  try {
    localStorage.setItem("sharpconnect_events", JSON.stringify(logs));
  } catch {}
}

// ─── LOG EVENT ────────────────────────────────────────────────

export async function logEvent(
  campaignId: string,
  type: EventType,
  metadata: Record<string, string> = {},
  status: "success" | "failed" = "success",
  error?: string
): Promise<EventLog> {
  const event: EventLog = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    campaignId,
    type,
    timestamp: new Date().toISOString(),
    metadata,
    status,
    error,
  };

  if (isSupabaseConfigured) {
    await supabase.from("event_logs").insert({
      campaign_id: campaignId,
      event_type: type,
      metadata: metadata as any,
      status,
      error: error || "",
    });
  }

  const logs = lsGetLogs();
  logs.unshift(event);
  lsSetLogs(logs);
  return event;
}

// ─── GET EVENTS ───────────────────────────────────────────────

export async function getEventLogs(limit = 200): Promise<EventLog[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from("event_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!error && data) {
      return data.map((row) => ({
        id: row.id,
        campaignId: row.campaign_id,
        type: row.event_type as EventType,
        timestamp: row.created_at,
        metadata: (row.metadata as Record<string, string>) || {},
        status: (row.status as "success" | "failed") || "success",
        error: row.error || undefined,
      }));
    }
  }
  return lsGetLogs().slice(0, limit);
}

export async function getEventsByCampaign(campaignId: string): Promise<EventLog[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from("event_logs")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false });
    if (!error && data) {
      return data.map((row) => ({
        id: row.id,
        campaignId: row.campaign_id,
        type: row.event_type as EventType,
        timestamp: row.created_at,
        metadata: (row.metadata as Record<string, string>) || {},
        status: (row.status as "success" | "failed") || "success",
        error: row.error || undefined,
      }));
    }
  }
  return lsGetLogs().filter((e) => e.campaignId === campaignId);
}

export function getEventsByType(type: EventType, limit = 50): EventLog[] {
  return lsGetLogs().filter((e) => e.type === type).slice(0, limit);
}

export function logError(campaignId: string, message: string, metadata: Record<string, string> = {}) {
  return logEvent(campaignId, "error", metadata, "failed", message);
}

export function clearEventLogs() {
  if (isSupabaseConfigured) {
    supabase.from("event_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000").then(() => {}, (e) => console.error("[clearEventLogs] delete failed:", e));
  }
  localStorage.removeItem("sharpconnect_events");
}

// ─── NOTIFICATION LOGS (from notification_logs table) ─────────

export interface NotificationLogEntry {
  id: string;
  campaignId: string;
  channel: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  sentAt: string;
}

export async function getNotificationLogs(limit = 200): Promise<NotificationLogEntry[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from("notification_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!error && data) {
      return data.map((row) => ({
        id: row.id,
        campaignId: row.campaign_id,
        channel: row.channel,
        recipient: row.recipient,
        subject: row.subject,
        body: row.body,
        status: row.status,
        sentAt: row.created_at,
      }));
    }
  }
  return [];
}

export function clearNotificationLogs() {
  if (isSupabaseConfigured) {
    supabase.from("notification_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000").then(() => {}, (e) => console.error("[clearNotificationLogs] delete failed:", e));
  }
}

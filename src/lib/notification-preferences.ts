import type { NotificationType, AppNotification, NotificationGroup } from "./notifications";

/* ─── STORAGE KEY ────────────────────────────────────────── */

const STORAGE_KEY = "sharpconnect_notification_preferences";

/* ─── TYPE ───────────────────────────────────────────────── */

export interface NotificationPreferences {
  [type: string]: boolean;
}

/* ─── TYPE METADATA FOR UI ───────────────────────────────── */

export interface NotificationTypeMeta {
  type: NotificationType;
  label: string;
  description: string;
  icon: string;
  group: NotificationGroup;
}

export const NOTIFICATION_TYPE_META: NotificationTypeMeta[] = [
  { type: "new_campaign",              label: "New Campaign",         description: "When an artist submits a new campaign",          icon: "🎵", group: "workflow" },
  { type: "admin_approved",            label: "Admin Approved",       description: "When an admin approves the edit",               icon: "👍", group: "workflow" },
  { type: "campaign_completed",        label: "Campaign Completed",   description: "When a campaign finishes successfully",         icon: "🎉", group: "workflow" },
  { type: "support_request",           label: "Support Request",      description: "When a support or workflow error occurs",       icon: "💬", group: "workflow" },
  { type: "editor_assigned",           label: "Editor Assigned",      description: "When an editor is assigned to a campaign",       icon: "👤", group: "workflow" },
  { type: "editor_submitted",          label: "Editor Submitted",     description: "When an editor submits their work for review",  icon: "🎬", group: "revision" },
  { type: "revision_requested",        label: "Revision Requested",   description: "When a revision is requested from the editor",  icon: "🔄", group: "revision" },
  { type: "artist_revision_requested", label: "Artist Revision",      description: "When an artist requests changes",               icon: "🔄", group: "revision" },
  { type: "campaign_scheduled",        label: "Campaign Scheduled",   description: "When a campaign is scheduled for posting",      icon: "📅", group: "scheduling" },
  { type: "post_submitted",            label: "Post Submitted",       description: "When a TikTok post URL is submitted",           icon: "📤", group: "scheduling" },
  { type: "post_verified",             label: "Post Verified",        description: "When a post is verified and marked live",       icon: "🔗", group: "scheduling" },
  { type: "overdue_campaign",          label: "Overdue Campaign",     description: "When a scheduled campaign passes its due date", icon: "⏰", group: "scheduling" },
  { type: "payment_uploaded",          label: "Payment Uploaded",     description: "When an artist uploads payment proof",          icon: "💰", group: "payment" },
  { type: "payment_approved",          label: "Payment Approved",     description: "When payment is verified and approved",         icon: "✅", group: "payment" },
  { type: "artist_review_ready",       label: "Review Ready",         description: "When artist review link is generated",          icon: "🎨", group: "artist" },
  { type: "artist_approved",           label: "Artist Approved",      description: "When an artist approves the final version",     icon: "✅", group: "artist" },
  { type: "ai_alert",                  label: "AI Alert",             description: "When AI Copilot generates an alert or insight", icon: "🤖", group: "ai" },
];

/* ─── DEFAULTS ───────────────────────────────────────────── */

export function getDefaultPreferences(): NotificationPreferences {
  const prefs: NotificationPreferences = {};
  for (const meta of NOTIFICATION_TYPE_META) {
    prefs[meta.type] = true;
  }
  return prefs;
}

/* ─── STORAGE ────────────────────────────────────────────── */

export function getNotificationPreferences(): NotificationPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Merge with defaults to catch any new types
      return { ...getDefaultPreferences(), ...parsed };
    }
  } catch { /* ignore */ }
  return getDefaultPreferences();
}

export function saveNotificationPreferences(prefs: NotificationPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("sharpconnect:prefs-changed", { detail: prefs }));
    }
  } catch { /* ignore */ }
}

export function updateNotificationPreference(type: NotificationType, enabled: boolean): NotificationPreferences {
  const prefs = getNotificationPreferences();
  prefs[type] = enabled;
  saveNotificationPreferences(prefs);
  return prefs;
}

export function resetNotificationPreferences(): NotificationPreferences {
  const prefs = getDefaultPreferences();
  saveNotificationPreferences(prefs);
  return prefs;
}

/* ─── QUERIES ────────────────────────────────────────────── */

export function isNotificationEnabled(type: NotificationType): boolean {
  const prefs = getNotificationPreferences();
  return prefs[type] !== false; // default to true if not set
}

export function getEnabledNotificationTypes(): NotificationType[] {
  const prefs = getNotificationPreferences();
  return NOTIFICATION_TYPE_META
    .filter((meta) => prefs[meta.type] !== false)
    .map((meta) => meta.type);
}

export function filterNotificationsByPreferences(notifications: AppNotification[]): AppNotification[] {
  const prefs = getNotificationPreferences();
  return notifications.filter((n) => prefs[n.type] !== false);
}

/* ─── GROUP HELPERS ──────────────────────────────────────── */

export function getTypesByGroup(group: NotificationGroup): NotificationTypeMeta[] {
  return NOTIFICATION_TYPE_META.filter((meta) => meta.group === group);
}

export function getGroupEnabledCount(group: NotificationGroup): { enabled: number; total: number } {
  const types = getTypesByGroup(group);
  const prefs = getNotificationPreferences();
  return {
    total: types.length,
    enabled: types.filter((t) => prefs[t.type] !== false).length,
  };
}

export function setGroupPreference(group: NotificationGroup, enabled: boolean): NotificationPreferences {
  const prefs = getNotificationPreferences();
  for (const meta of NOTIFICATION_TYPE_META) {
    if (meta.group === group) {
      prefs[meta.type] = enabled;
    }
  }
  saveNotificationPreferences(prefs);
  return prefs;
}
import { supabase, isSupabaseConfigured } from "./supabase";
import { filterNotificationsByPreferences, getNotificationPreferences } from "./notification-preferences";
import { triggerDispatch, getDispatchEnabled, getDispatchChannelEnabled } from "./notification-dispatch";

export type NotificationType =
  | "new_campaign"
  | "payment_uploaded"
  | "payment_approved"
  | "editor_assigned"
  | "editor_submitted"
  | "revision_requested"
  | "admin_approved"
  | "campaign_scheduled"
  | "post_submitted"
  | "post_verified"
  | "overdue_campaign"
  | "campaign_completed"
  | "support_request"
  | "artist_review_ready"
  | "artist_approved"
  | "artist_revision_requested"
  | "ai_alert";

export type NotificationPriority = "low" | "medium" | "high" | "urgent";

export type Notification = AppNotification;

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  campaignId?: string;
  read: boolean;
  priority: NotificationPriority;
  createdAt: string;
  triggeredBy?: string;
}

const NOTIFICATIONS_KEY = "sharpconnect_notifications";

// ─── EVENT BUS ─────────────────────────────────────────────────

const NOTIFY_EVENT = "sharpconnect:notify";

export function dispatchNotifyEvent() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(NOTIFY_EVENT));
  }
}

export function onNotify(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(NOTIFY_EVENT, callback);
  return () => window.removeEventListener(NOTIFY_EVENT, callback);
}

// ─── LOCALSTORAGE ──────────────────────────────────────────────

function lsGet(): AppNotification[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function lsSave(items: AppNotification[]) {
  try { localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(items)); } catch {}
}

// ─── HELPERS ───────────────────────────────────────────────────

function genId(): string {
  return `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

const PRIORITY_ORDER: Record<NotificationPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// ─── CORE: ADD NOTIFICATION ────────────────────────────────────

export function addNotification(
  type: NotificationType,
  title: string,
  message: string,
  campaignId?: string,
  priority: NotificationPriority = "medium",
  triggeredBy?: string
): AppNotification {
  const notif: AppNotification = {
    id: genId(),
    type,
    title,
    message,
    campaignId,
    read: false,
    priority,
    createdAt: new Date().toISOString(),
    triggeredBy,
  };

  if (isSupabaseConfigured) {
    supabase.from("notifications").insert({
      type,
      title,
      message,
      campaign_id: campaignId || null,
      priority,
      triggered_by: triggeredBy || "",
      read_status: false,
    }).then(() => {}, (e) => console.error("[addNotification] insert failed:", e));
  }

  const all = lsGet();
  all.unshift(notif);
  lsSave(all);

  dispatchNotifyEvent();

  // Fire-and-forget outbound dispatch (Telegram/email)
  if (getDispatchEnabled() && (getDispatchChannelEnabled("telegram") || getDispatchChannelEnabled("email"))) {
    triggerDispatch(notif);
  }

  return notif;
}

// ─── QUERIES ───────────────────────────────────────────────────

export function getNotifications(): AppNotification[] {
  return lsGet();
}

export async function getAllNotifications(): Promise<AppNotification[]> {
  return getNotifications();
}

export function getUnreadNotifications(): AppNotification[] {
  return lsGet().filter((n) => !n.read).sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  );
}

export function getUnreadCount(): number {
  return lsGet().filter((n) => !n.read).length;
}

export function getUrgentUnreadCount(): number {
  return lsGet().filter((n) => !n.read && n.priority === "urgent").length;
}

export function getRecentNotifications(limit: number = 20): AppNotification[] {
  return lsGet().slice(0, limit);
}

export function getCampaignNotifications(campaignId: string): AppNotification[] {
  return lsGet().filter((n) => n.campaignId === campaignId);
}

// ─── MUTATIONS ─────────────────────────────────────────────────

export function markAsRead(id: string) {
  const all = lsGet();
  const idx = all.findIndex((n) => n.id === id);
  if (idx === -1) return;
  all[idx].read = true;
  lsSave(all);
  dispatchNotifyEvent();
}

export function markAllAsRead() {
  const all = lsGet();
  all.forEach((n) => (n.read = true));
  lsSave(all);
  dispatchNotifyEvent();

  if (isSupabaseConfigured) {
    supabase.from("notifications").update({ read_status: true }).eq("read_status", false).then(() => {}, (e) => console.error("[markAllAsRead] update failed:", e));
  }
}

// ─── OPERATIONAL SUMMARY ───────────────────────────────────────

export function getOperationalSummary(): string[] {
  const all = lsGet();
  const unread = all.filter((n) => !n.read);
  const lines: string[] = [];

  const urgent = unread.filter((n) => n.priority === "urgent");
  const high = unread.filter((n) => n.priority === "high");
  const pendingReview = unread.filter((n) => n.type === "editor_submitted");
  const overduePosts = unread.filter((n) => n.type === "overdue_campaign");
  const pendingVerification = unread.filter((n) => n.type === "post_submitted");

  if (urgent.length > 0) lines.push(`⚠ ${urgent.length} urgent notification${urgent.length > 1 ? "s" : ""}`);
  if (high.length > 0) lines.push(`• ${high.length} high priority notification${high.length > 1 ? "s" : ""}`);
  if (pendingReview.length > 0) lines.push(`• ${pendingReview.length} editor submission${pendingReview.length > 1 ? "s" : ""} pending review`);
  if (overduePosts.length > 0) lines.push(`• ${overduePosts.length} overdue post${overduePosts.length > 1 ? "s" : ""}`);
  if (pendingVerification.length > 0) lines.push(`• ${pendingVerification.length} TikTok post${pendingVerification.length > 1 ? "s" : ""} pending verification`);

  const totalUnread = unread.length;
  if (lines.length === 0) {
    lines.push("All caught up — no unread notifications.");
  } else {
    lines.push(`\n${totalUnread} unread total`);
  }

  return lines;
}

// ─── BACKWARD COMPATIBILITY ────────────────────────────────────

const TYPE_TITLES: Record<string, string> = {
  new_campaign: "New Campaign",
  payment_uploaded: "Payment Uploaded",
  payment_approved: "Payment Approved",
  editor_assigned: "Editor Assigned",
  editor_submitted: "Editor Submission",
  revision_requested: "Revision Requested",
  admin_approved: "Campaign Approved",
  campaign_scheduled: "Campaign Scheduled",
  post_submitted: "Post Submitted",
  post_verified: "Post Verified",
  overdue_campaign: "Overdue Campaign",
  campaign_completed: "Campaign Completed",
  support_request: "Support Request",
  artist_review_ready: "Artist Review Ready",
  artist_approved: "Artist Approved",
  artist_revision_requested: "Artist Revision Requested",
};

const TYPE_PRIORITY: Record<string, NotificationPriority> = {
  new_campaign: "medium",
  payment_uploaded: "medium",
  payment_approved: "high",
  editor_assigned: "medium",
  editor_submitted: "high",
  revision_requested: "high",
  admin_approved: "high",
  campaign_scheduled: "medium",
  post_submitted: "medium",
  post_verified: "low",
  overdue_campaign: "urgent",
  campaign_completed: "low",
  support_request: "medium",
  artist_review_ready: "high",
  artist_approved: "high",
  artist_revision_requested: "high",
};

export function addAlert(type: string, message: string, campaignId: string) {
  const notifType = (TYPE_TITLES[type] ? type : "support_request") as NotificationType;
  addNotification(
    notifType,
    TYPE_TITLES[notifType] || "Alert",
    message,
    campaignId,
    TYPE_PRIORITY[notifType] || "medium"
  );
}

// Called by the workflow engine
/** Creates an in-app admin notification (not email/SMS). */
export function addAdminNotification(campaignId: string, message: string) {
  addNotification("support_request", "Admin Alert", message, campaignId, "medium");
}

/** Creates an in-app admin notification that payment was approved. */
export function addPaymentApprovedNotification(campaignId: string, artistName: string, _email: string, total: number) {
  addNotification("payment_approved", "Payment Approved", `Payment of ${total} GHC confirmed for ${artistName}`, campaignId, "high");
}

/** Creates an in-app admin notification that campaign started. */
export function addCampaignStartedNotification(campaignId: string, artistName: string, _email: string) {
  addNotification("new_campaign", "Campaign Started", `Campaign started for ${artistName}`, campaignId, "medium");
}

/** Creates an in-app admin notification that campaign completed. */
export function addCampaignCompletedNotification(campaignId: string, artistName: string, _email: string, packageName: string) {
  addNotification("campaign_completed", "Campaign Completed", `Campaign completed for ${artistName} — ${packageName}`, campaignId, "low");
}

/** Creates an in-app admin notification that editor was assigned. */
export function addEditorAssignedNotification(campaignId: string, artistName: string, editor: string) {
  addNotification("editor_assigned", "Editor Assigned", `${editor} assigned to ${artistName}'s campaign`, campaignId, "medium");
}

/** Creates an in-app admin notification for a workflow error. */
export function addWorkflowErrorNotification(campaignId: string, message: string) {
  addNotification("support_request", "Workflow Error", message, campaignId, "urgent");
}

// ─── SUPABASE REALTIME SUBSCRIPTION ────────────────────────────

export function subscribeToNotifications(onNew: (n: AppNotification) => void): () => void {
  if (!isSupabaseConfigured) return () => {};

  const channel = supabase
    .channel("notifications")
    .on("postgres_changes" as any, {
      event: "INSERT",
      schema: "public",
      table: "notifications",
    }, (payload: any) => {
      const row = payload.new;
      const notif: AppNotification = {
        id: row.id || genId(),
        type: row.type as NotificationType,
        title: row.title || "",
        message: row.message || "",
        campaignId: row.campaign_id || undefined,
        read: row.read_status || false,
        priority: (row.priority as NotificationPriority) || "medium",
        createdAt: row.created_at || new Date().toISOString(),
        triggeredBy: row.triggered_by || undefined,
      };
      onNew(notif);
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

/* ─── PREFERENCE-AWARE GETTERS ──────────────────────────── */

export function getFilteredNotifications(): AppNotification[] {
  return filterNotificationsByPreferences(lsGet()).sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  );
}

export function getFilteredUnreadCount(): number {
  return lsGet().filter((n) => !n.read && getNotificationPreferences()[n.type] !== false).length;
}

export function getFilteredUrgentUnreadCount(): number {
  return lsGet().filter((n) => !n.read && n.priority === "urgent" && getNotificationPreferences()[n.type] !== false).length;
}

export function clearNotifications() {
  localStorage.removeItem(NOTIFICATIONS_KEY);
  dispatchNotifyEvent();
}

/** Creates an in-app admin notification that payment was received. */
export function addPaymentReceivedNotification(campaignId: string, artistName: string, _email: string) {
  addNotification("payment_uploaded", "Payment Received", `Payment received from ${artistName}`, campaignId, "medium");
}

/* ─── DEEP LINKING ───────────────────────────────────────── */

export function getNotificationDeepLink(n: AppNotification): string {
  if (!n.campaignId) return "/admin";
  const base = "/admin/campaigns";
  if (n.type === "editor_submitted" || n.type === "revision_requested") {
    return `${base}?campaign=${n.campaignId}&tab=assignment`;
  }
  if (n.type === "new_campaign" || n.type === "payment_uploaded" || n.type === "payment_approved") {
    return `${base}?campaign=${n.campaignId}&tab=payment`;
  }
  if (n.type === "post_submitted" || n.type === "post_verified" || n.type === "overdue_campaign") {
    return `${base}?campaign=${n.campaignId}&tab=scheduling`;
  }
  if (n.type === "artist_approved" || n.type === "artist_revision_requested") {
    return `/track?campaign=${n.campaignId}`;
  }
  if (n.type === "ai_alert") {
    return `${base}?campaign=${n.campaignId}&tab=overview`;
  }
  return `${base}?campaign=${n.campaignId}`;
}

/* ─── GROUPING ───────────────────────────────────────────── */

export type NotificationGroup = "workflow" | "revision" | "scheduling" | "payment" | "artist" | "ai" | "other";

const NOTIFICATION_GROUP_MAP: Partial<Record<NotificationType, NotificationGroup>> = {
  new_campaign: "workflow",
  payment_uploaded: "payment",
  payment_approved: "payment",
  editor_assigned: "workflow",
  editor_submitted: "revision",
  revision_requested: "revision",
  admin_approved: "workflow",
  campaign_scheduled: "scheduling",
  post_submitted: "scheduling",
  post_verified: "scheduling",
  overdue_campaign: "scheduling",
  campaign_completed: "workflow",
  support_request: "other",
  artist_review_ready: "artist",
  artist_approved: "artist",
  artist_revision_requested: "artist",
  ai_alert: "ai",
};

export function getNotificationGroup(n: AppNotification): NotificationGroup {
  return NOTIFICATION_GROUP_MAP[n.type] || "other";
}

export const GROUP_META: Record<NotificationGroup, { label: string; icon: string }> = {
  workflow:    { label: "Workflow",    icon: "⚙️" },
  revision:   { label: "Revisions",   icon: "🔄" },
  scheduling: { label: "Scheduling",  icon: "📅" },
  payment:    { label: "Payments",    icon: "💳" },
  artist:     { label: "Artist",      icon: "🎨" },
  ai:         { label: "AI Alerts",   icon: "🤖" },
  other:      { label: "Other",       icon: "📌" },
};

export function getNotificationGroupColor(group: NotificationGroup): string {
  switch (group) {
    case "workflow":   return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    case "revision":   return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "scheduling": return "bg-sky-500/10 text-sky-400 border-sky-500/20";
    case "payment":    return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "artist":     return "bg-pink-500/10 text-pink-400 border-pink-500/20";
    case "ai":         return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    default:           return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  }
}

/* ─── PRIORITY STYLES ────────────────────────────────────── */

export function getPriorityBorder(priority: NotificationPriority): string {
  switch (priority) {
    case "urgent": return "border-l-red-500";
    case "high":   return "border-l-orange-500";
    case "medium": return "border-l-blue-500";
    case "low":    return "border-l-zinc-600";
  }
}

export function getPriorityGlow(priority: NotificationPriority): string {
  switch (priority) {
    case "urgent": return "rgba(239,68,68,0.4)";
    case "high":   return "rgba(249,115,22,0.4)";
    case "medium": return "rgba(59,130,246,0.4)";
    case "low":    return "rgba(113,113,122,0.4)";
  }
}

/* ─── NOTIFICATION EXPORT ─────────────────────────────────── */

export function exportNotificationsToCSV(notifications: AppNotification[]): string {
  const headers = ["Timestamp", "Type", "Title", "Message", "Campaign ID", "Priority", "Read", "Triggered By"];
  const rows = notifications.map((n) => [
    n.createdAt,
    n.type,
    `"${n.title.replace(/"/g, '""')}"`,
    `"${n.message.replace(/"/g, '""')}"`,
    n.campaignId || "",
    n.priority,
    n.read ? "Yes" : "No",
    n.triggeredBy || "",
  ]);
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export function exportNotificationsToJSON(notifications: AppNotification[]): string {
  return JSON.stringify(notifications, null, 2);
}

export async function exportNotificationsToPDF(notifications: AppNotification[]): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf") as Promise<typeof import("jspdf")>,
    import("jspdf-autotable") as Promise<{ default: (doc: any, opts: any) => void }>,
  ]);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(239, 68, 68);
  doc.text("SharpConnect — Notifications", 14, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`, 14, 24);
  doc.text(`Total notifications: ${notifications.length}`, 14, 29);

  const head = [["Timestamp", "Type", "Title", "Message", "Campaign", "Priority", "Status"]];
  const body = notifications.map((n) => [
    new Date(n.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
    n.type,
    n.title,
    n.message,
    n.campaignId || "-",
    n.priority,
    n.read ? "Read" : "Unread",
  ]);

  autoTable(doc, {
    head,
    body,
    startY: 33,
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1.5, font: "helvetica" },
    headStyles: { fillColor: [239, 68, 68], textColor: [255, 255, 255], fontSize: 7, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 26 },
      2: { cellWidth: 30 },
      3: { cellWidth: "auto" },
      4: { cellWidth: 22 },
      5: { cellWidth: 16 },
      6: { cellWidth: 14 },
    },
    margin: { top: 33 },
  });

  doc.save(`notifications-${new Date().toISOString().split("T")[0]}.pdf`);
}

export function downloadNotifications(
  notifications: AppNotification[],
  format: "csv" | "json" | "pdf",
  filename?: string,
): void {
  if (format === "pdf") {
    exportNotificationsToPDF(notifications).catch(() => {});
    return;
  }
  const content = format === "csv"
    ? exportNotificationsToCSV(notifications)
    : exportNotificationsToJSON(notifications);
  const mime = format === "csv" ? "text/csv" : "application/json";
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `notifications-${new Date().toISOString().split("T")[0]}.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

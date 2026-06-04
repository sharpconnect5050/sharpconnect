import { supabase, isSupabaseConfigured, createAdminClient } from "./supabase";
import { triggerDispatch, getDispatchEnabled, getDispatchChannelEnabled } from "./notification-dispatch";

/* ─── EVENT TYPE CONSTANTS ────────────────────────────────── */

export const EVENT_TYPES = {
  CAMPAIGN_SUBMITTED: "campaign_submitted",
  PAYMENT_UPLOADED: "payment_uploaded",
  PAYMENT_VERIFIED: "payment_verified",
  PAYMENT_REJECTED: "payment_rejected",
  EDITOR_ASSIGNED: "editor_assigned",
  REVISION_UPLOADED: "revision_uploaded",
  REVISION_REQUESTED: "revision_requested",
  ARTIST_REVIEW_OPENED: "artist_review_opened",
  ARTIST_APPROVED: "artist_approved",
  ADMIN_APPROVED: "admin_approved",
  CAMPAIGN_SCHEDULED: "campaign_scheduled",
  TIKTOK_SUBMITTED: "tiktok_submitted",
  TIKTOK_VERIFIED: "tiktok_verified",
  CAMPAIGN_MARKED_LIVE: "campaign_live",
  CAMPAIGN_COMPLETED: "campaign_completed",
  AI_ALERT: "ai_alert",
  COMMENT_ADDED: "comment_added",
  NOTE_ADDED: "note_added",
  PRIORITY_CHANGED: "priority_changed",
  STATUS_OVERRIDE: "status_override",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

export const ACTOR_TYPES = ["admin", "artist", "editor", "ai", "system"] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

/* ─── TYPES ───────────────────────────────────────────────── */

export type ActivityCategory = "approval" | "revision" | "payment" | "assignment" | "scheduling" | "posting" | "system" | "ai" | "comment";

export interface ActivityEntry {
  id: string;
  campaignId: string;
  type: string;
  category: ActivityCategory;
  actor: string;
  actorRole: ActorType;
  title: string;
  description: string;
  metadata: Record<string, string>;
  timestamp: string;
  version?: number;
}

export interface CreateEventInput {
  campaignId: string;
  eventType: EventType;
  actorType: ActorType;
  actorName: string;
  message: string;
  metadata?: Record<string, string>;
}

/* ─── CATEGORY METADATA ───────────────────────────────────── */

export interface ActivityCategoryMeta {
  label: string;
  icon: string;
  dot: string;
  glow: string;
  bg: string;
}

export const ACTIVITY_CATEGORIES: Record<ActivityCategory, ActivityCategoryMeta> = {
  approval:    { label: "Approval",    icon: "✅", dot: "bg-emerald-500", glow: "rgba(34,197,94,0.4)",   bg: "bg-emerald-500/[0.06]" },
  revision:   { label: "Revision",    icon: "🔄", dot: "bg-amber-500",   glow: "rgba(245,158,11,0.4)",  bg: "bg-amber-500/[0.06]" },
  payment:    { label: "Payment",     icon: "💳", dot: "bg-blue-500",    glow: "rgba(59,130,246,0.4)",  bg: "bg-blue-500/[0.06]" },
  assignment: { label: "Assignment",  icon: "👤", dot: "bg-orange-500",  glow: "rgba(249,115,22,0.4)",  bg: "bg-orange-500/[0.06]" },
  scheduling: { label: "Scheduling",  icon: "📅", dot: "bg-sky-500",     glow: "rgba(14,165,233,0.4)",  bg: "bg-sky-500/[0.06]" },
  posting:    { label: "Posting",     icon: "🔥", dot: "bg-red-500",     glow: "rgba(239,68,68,0.4)",   bg: "bg-red-500/[0.06]" },
  system:     { label: "System",      icon: "⚙️", dot: "bg-zinc-500",    glow: "rgba(113,113,122,0.4)", bg: "bg-zinc-500/[0.06]" },
  ai:         { label: "AI",          icon: "🤖", dot: "bg-purple-500",  glow: "rgba(168,85,247,0.4)",  bg: "bg-purple-500/[0.06]" },
  comment:    { label: "Comment",     icon: "💬", dot: "bg-pink-500",    glow: "rgba(236,72,153,0.4)",  bg: "bg-pink-500/[0.06]" },
};

/* ─── STORAGE ─────────────────────────────────────────────── */

const STORAGE_KEY = "sharpconnect_activity_log";
const MAX_EVENTS = 500;

function getAll(): ActivityEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveAll(entries: ActivityEntry[]) {
  try {
    const trimmed = entries.slice(0, MAX_EVENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {}
}

function genId(): string {
  return `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/* ─── SUPABASE PERSISTENCE ────────────────────────────────── */

function persistToSupabase(activity: ActivityEntry): void {
  if (!isSupabaseConfigured) return;
  supabase.from("activity_logs").insert({
    campaign_id: activity.campaignId,
    event_type: activity.type,
    category: activity.category,
    actor_type: activity.actorRole,
    actor_name: activity.actor,
    message: activity.description,
    title: activity.title,
    metadata: activity.metadata as any,
    version: activity.version || null,
  }).then(({ error }) => {
    if (error) console.error("[activity-log] Supabase insert failed:", error);
  });
}

/* ─── LOG ACTIVITY (CLIENT-SIDE) ──────────────────────────── */

/* ─── ACTIVITY EVENT → NOTIFICATION DISPATCH ────────────── */

const DISPATCHABLE_TYPES = new Set([
  "campaign_created", "payment_uploaded", "payment_approved",
  "payment_rejected", "editor_assigned", "revision_requested",
  "artist_revision_requested", "campaign_scheduled", "tiktok_submitted",
  "tiktok_verified", "campaign_live", "campaign_completed", "ai_alert",
  "admin_approved", "artist_approved", "status_override",
]);

const DISPATCH_PRIORITY: Record<string, string> = {
  payment_rejected: "urgent",
  ai_alert: "urgent",
  status_override: "high",
  revision_requested: "high",
  editor_assigned: "medium",
  campaign_created: "medium",
  payment_uploaded: "medium",
  payment_approved: "high",
  admin_approved: "high",
  artist_approved: "high",
  campaign_scheduled: "medium",
  tiktok_submitted: "medium",
  tiktok_verified: "low",
  campaign_live: "low",
  campaign_completed: "low",
};

function tryDispatchFromActivity(entry: ActivityEntry): void {
  if (typeof window === "undefined") return;
  if (!getDispatchEnabled() || (!getDispatchChannelEnabled("telegram") && !getDispatchChannelEnabled("email"))) return;
  if (!DISPATCHABLE_TYPES.has(entry.type)) return;

  const base = typeof window !== "undefined" ? window.location.origin : "";
  fetch(`${base}/api/notifications/dispatch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": sessionStorage.getItem("sharpconnect_admin") || "",
    },
    body: JSON.stringify({
      type: entry.type,
      title: entry.title,
      message: `${entry.description} [${entry.campaignId}]`,
      campaignId: entry.campaignId,
      priority: DISPATCH_PRIORITY[entry.type] || "medium",
      triggeredBy: entry.actor,
      createdAt: entry.timestamp,
      read: false,
      id: entry.id,
    }),
  }).catch(() => {});
}

export function logActivity(entry: Omit<ActivityEntry, "id" | "timestamp">): ActivityEntry {
  const activity: ActivityEntry = {
    ...entry,
    id: genId(),
    timestamp: new Date().toISOString(),
  };

  persistToSupabase(activity);

  const all = getAll();
  all.unshift(activity);
  saveAll(all);

  // Dispatch event for realtime UI updates
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("sharpconnect:activity", { detail: activity }));
  }

  // Fire-and-forget outbound dispatch for important events
  tryDispatchFromActivity(activity);

  return activity;
}

/* ─── CREATE EVENT (SERVER-SIDE) ──────────────────────────── */

export async function createServerEvent(input: CreateEventInput): Promise<ActivityEntry | null> {
  const admin = createAdminClient();
  if (!admin) {
    console.warn("[activity-log] Supabase not configured, event not persisted");
    return null;
  }

  const activity: ActivityEntry = {
    id: `srv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    campaignId: input.campaignId,
    type: input.eventType,
    category: mapEventTypeToCategory(input.eventType),
    actor: input.actorName,
    actorRole: input.actorType,
    title: formatEventTitle(input.eventType, input.actorName),
    description: input.message,
    metadata: input.metadata || {},
    timestamp: new Date().toISOString(),
  };

  try {
    const { error } = await admin.from("activity_logs").insert({
      campaign_id: activity.campaignId,
      event_type: activity.type,
      category: activity.category,
      actor_type: activity.actorRole,
      actor_name: activity.actor,
      message: activity.description,
      title: activity.title,
      metadata: activity.metadata as any,
    });
    if (error) {
      console.error("[activity-log] createServerEvent failed:", error);
      return null;
    }
    return activity;
  } catch (err) {
    console.error("[activity-log] createServerEvent threw:", err);
    return null;
  }
}

function mapEventTypeToCategory(type: string): ActivityCategory {
  if (type.includes("approved") || type === "campaign_completed") return "approval";
  if (type.includes("revision") || type.includes("uploaded")) return "revision";
  if (type.includes("payment")) return "payment";
  if (type.includes("assign")) return "assignment";
  if (type.includes("schedule")) return "scheduling";
  if (type.includes("tiktok") || type === "campaign_live") return "posting";
  if (type.includes("alert") || type.includes("ai")) return "ai";
  if (type.includes("comment")) return "comment";
  return "system";
}

function formatEventTitle(type: string, actor: string): string {
  const titles: Record<string, string> = {
    campaign_submitted: "Campaign Submitted",
    payment_uploaded: "Payment Uploaded",
    payment_verified: "Payment Approved",
    payment_rejected: "Payment Rejected",
    editor_assigned: "Editor Assigned",
    revision_uploaded: "Revision Uploaded",
    revision_requested: "Changes Requested",
    artist_review_opened: "Review Link Opened",
    artist_approved: "Artist Approved ✅",
    admin_approved: "Admin Approved",
    campaign_scheduled: "Campaign Scheduled",
    tiktok_submitted: "TikTok Link Submitted",
    tiktok_verified: "TikTok Verified ✅",
    campaign_live: "Campaign Live 🔥",
    campaign_completed: "Campaign Completed 🎉",
    ai_alert: "AI Alert",
    comment_added: "Comment Added 💬",
    note_added: "Note Added",
    priority_changed: "Priority Changed",
    status_override: "Status Changed",
  };
  return titles[type] || "Activity Event";
}

/* ─── SERVER-SIDE QUERIES ─────────────────────────────────── */

export async function getServerActivityLog(
  campaignId: string,
  options?: { limit?: number; offset?: number; category?: ActivityCategory },
): Promise<{ entries: ActivityEntry[]; total: number }> {
  const admin = createAdminClient();
  if (!admin) return { entries: [], total: 0 };

  try {
    let query = admin
      .from("activity_logs")
      .select("*", { count: "exact" })
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false });

    if (options?.category) {
      query = query.eq("category", options.category);
    }

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) throw error;

    const entries = (data || []).map(mapRowToEntry);
    return { entries, total: count || 0 };
  } catch (err) {
    console.error("[activity-log] getServerActivityLog failed:", err);
    return { entries: [], total: 0 };
  }
}

function mapRowToEntry(row: any): ActivityEntry {
  return {
    id: row.id || `sb-${Date.now()}`,
    campaignId: row.campaign_id,
    type: row.event_type || row.type,
    category: row.category || "system",
    actor: row.actor_name || row.actor || "System",
    actorRole: row.actor_type || row.actor_role || "system",
    title: row.title || "",
    description: row.message || row.description || "",
    metadata: row.metadata || {},
    timestamp: row.created_at || new Date().toISOString(),
    version: row.version || undefined,
  };
}

/* ─── QUERIES ─────────────────────────────────────────────── */

export function getCampaignActivityLog(campaignId: string, limit = 100): ActivityEntry[] {
  return getAll().filter((a) => a.campaignId === campaignId).slice(0, limit);
}

export function getRecentActivityLog(limit = 50): ActivityEntry[] {
  return getAll().slice(0, limit);
}

export function getActivityLogByCategory(category: ActivityCategory, limit = 50): ActivityEntry[] {
  return getAll().filter((a) => a.category === category).slice(0, limit);
}

export function getActivityLogByActor(actor: string, limit = 50): ActivityEntry[] {
  return getAll().filter((a) => a.actor === actor).slice(0, limit);
}

/* ─── REALTIME CONNECTION TRACKING ───────────────────────── */

export type RealtimeStatus = "connected" | "connecting" | "disconnected";

let realtimeStatus: RealtimeStatus = "disconnected";
const statusListeners = new Set<(status: RealtimeStatus) => void>();

export function getRealtimeStatus(): RealtimeStatus {
  return realtimeStatus;
}

export function onRealtimeStatusChange(listener: (status: RealtimeStatus) => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

function setStatus(s: RealtimeStatus) {
  realtimeStatus = s;
  statusListeners.forEach((fn) => fn(s));
}

/* ─── DEDUPLICATION ──────────────────────────────────────── */

const recentEntryKeys = new Set<string>();
const DEDUP_WINDOW = 5000; // 5 seconds

function dedupKey(entry: ActivityEntry): string {
  return `${entry.campaignId}:${entry.type}:${entry.actor}:${new Date(entry.timestamp).getTime()}`;
}

function isDuplicate(entry: ActivityEntry): boolean {
  const key = dedupKey(entry);
  if (recentEntryKeys.has(key)) return true;
  recentEntryKeys.add(key);
  setTimeout(() => recentEntryKeys.delete(key), DEDUP_WINDOW);
  return false;
}

/* ─── REALTIME ACTIVITY SUBSCRIPTION ─────────────────────── */

type ActivityCallback = (entry: ActivityEntry) => void;

let sharedChannel: ReturnType<typeof supabase.channel> | null = null;
let channelCallbacks: ActivityCallback[] = [];
let channelSubscribed = false;

export function subscribeToActivity(callback: (entry: ActivityEntry) => void): () => void {
  if (typeof window === "undefined") return () => {};

  // CustomEvent listener for same-tab updates
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail && !isDuplicate(detail as ActivityEntry)) {
      callback(detail as ActivityEntry);
    }
  };
  window.addEventListener("sharpconnect:activity", handler);

  // Supabase realtime channel (singleton — shared across all callers)
  if (isSupabaseConfigured && !sharedChannel) {
    setStatus("connecting");
    sharedChannel = supabase
      .channel("activity_logs_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_logs" }, (payload: any) => {
        const row: any = payload.new;
        if (row && row.campaign_id) {
          const entry = mapRowToEntry(row);
          if (!isDuplicate(entry)) {
            channelCallbacks.forEach((cb) => cb(entry));
          }
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") { setStatus("connected"); channelSubscribed = true; }
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setStatus("disconnected");
      });
  }
  if (isSupabaseConfigured && sharedChannel) {
    channelCallbacks.push(callback);
  }

  return () => {
    window.removeEventListener("sharpconnect:activity", handler);
    if (isSupabaseConfigured && sharedChannel) {
      const idx = channelCallbacks.indexOf(callback);
      if (idx !== -1) channelCallbacks.splice(idx, 1);
      if (channelCallbacks.length === 0) {
        supabase.removeChannel(sharedChannel).catch(() => {});
        sharedChannel = null;
        channelSubscribed = false;
        setStatus("disconnected");
        recentEntryKeys.clear();
      }
    }
  };
}

/* ─── CAMPAIGN STATUS REALTIME ───────────────────────────── */

export type CampaignStatusEvent = {
  campaignId: string;
  from: string;
  to: string;
  changedBy: string;
  timestamp: string;
};

export function subscribeToCampaignStatus(callback: (event: CampaignStatusEvent) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail as CampaignStatusEvent | undefined;
    if (detail) callback(detail);
  };
  window.addEventListener("sharpconnect:campaign-status", handler);

  let unsub: (() => void) | null = null;
  if (isSupabaseConfigured) {
    const channel = supabase
      .channel("campaign_status_realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "campaigns" }, (payload: any) => {
        const old: any = payload.old;
        const updated: any = payload.new;
        if (old && updated && old.status !== updated.status) {
          callback({
            campaignId: updated.campaign_id || updated.campaignId || "",
            from: old.status || "",
            to: updated.status || "",
            changedBy: "System",
            timestamp: new Date().toISOString(),
          });
        }
      })
      .subscribe();
    unsub = () => { supabase.removeChannel(channel).catch(() => {}); };
  }

  return () => {
    window.removeEventListener("sharpconnect:campaign-status", handler);
    if (unsub) unsub();
  };
}

/* ─── DISPATCH STATUS CHANGE ─────────────────────────────── */

export function dispatchCampaignStatus(campaignId: string, from: string, to: string, changedBy: string) {
  const event: CampaignStatusEvent = { campaignId, from, to, changedBy, timestamp: new Date().toISOString() };
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("sharpconnect:campaign-status", { detail: event }));
  }
}

/* ─── PAGINATION ──────────────────────────────────────────── */

export function getCampaignActivityLogPaginated(
  campaignId: string, page = 0, pageSize = 25
): { entries: ActivityEntry[]; total: number; hasMore: boolean } {
  const all = getAll().filter((a) => a.campaignId === campaignId);
  const total = all.length;
  const start = page * pageSize;
  const entries = all.slice(start, start + pageSize);
  return { entries, total, hasMore: start + pageSize < total };
}

export function getRecentActivityLogPaginated(
  page = 0, pageSize = 25
): { entries: ActivityEntry[]; total: number; hasMore: boolean } {
  const all = getAll();
  const total = all.length;
  const start = page * pageSize;
  const entries = all.slice(start, start + pageSize);
  return { entries, total, hasMore: start + pageSize < total };
}

/* ─── HELPER FUNCTIONS ────────────────────────────────────── */

export function actorDisplay(name: string, role: string): string {
  if (role === "artist") return "Artist";
  if (role === "admin") return "Admin";
  if (role === "ai") return "AI Copilot";
  if (role === "system") return "System";
  return name;
}

export function formatActivityTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);

  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function formatActivityTimestamp(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function groupActivitiesByDate(entries: ActivityEntry[]): { label: string; entries: ActivityEntry[] }[] {
  const groups: { label: string; entries: ActivityEntry[] }[] = [];
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const yesterdayStr = new Date(now.getTime() - 86400000).toISOString().split("T")[0];

  let currentLabel = "";
  let current: ActivityEntry[] = [];

  for (const e of entries) {
    const dateStr = new Date(e.timestamp).toISOString().split("T")[0];
    let label: string;
    if (dateStr === todayStr) label = "Today";
    else if (dateStr === yesterdayStr) label = "Yesterday";
    else label = new Date(e.timestamp).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

    if (label !== currentLabel) {
      if (current.length > 0) groups.push({ label: currentLabel, entries: current });
      currentLabel = label;
      current = [];
    }
    current.push(e);
  }
  if (current.length > 0) groups.push({ label: currentLabel, entries: current });
  return groups;
}

/* ─── CONVENIENCE LOGGERS ─────────────────────────────────── */

export function logCampaignCreated(campaignId: string, artist: string) {
  return logActivity({
    campaignId, type: "campaign_created", category: "system",
    actor: "System", actorRole: "system",
    title: "Campaign Submitted", description: `${artist} submitted a new campaign`,
    metadata: { artist },
  });
}

export function logPaymentUploaded(campaignId: string, artistName: string, amount: string) {
  return logActivity({
    campaignId, type: "payment_uploaded", category: "payment",
    actor: "System", actorRole: "system",
    title: "Payment Uploaded", description: `${artistName} uploaded payment of ${amount}`,
    metadata: { artist: artistName, amount },
  });
}

export function logVersionUploaded(campaignId: string, editorName: string, version: number, notes: string) {
  return logActivity({
    campaignId, type: "version_uploaded", category: "revision",
    actor: editorName, actorRole: "editor",
    title: `Version ${version} Uploaded`, description: notes || `Editor uploaded version ${version}`,
    metadata: { editor: editorName, version: String(version) },
    version,
  });
}

export function logTikTokLinkSubmitted(campaignId: string, submittedBy: string, url: string) {
  return logActivity({
    campaignId, type: "tiktok_link_submitted", category: "posting",
    actor: submittedBy, actorRole: "system",
    title: "TikTok Link Submitted", description: "Post URL submitted for review",
    metadata: { url, submittedBy },
  });
}

export function logCampaignMarkedLive(campaignId: string, verifiedBy: string, url: string) {
  return logActivity({
    campaignId, type: "campaign_marked_live", category: "posting",
    actor: verifiedBy, actorRole: "admin",
    title: "Campaign Live 🔥", description: "Campaign verified and marked as posted",
    metadata: { verifiedBy, url },
  });
}

export function logPaymentApproved(campaignId: string, adminName: string, amount: string) {
  return logActivity({
    campaignId, type: "payment_approved", category: "payment",
    actor: adminName, actorRole: "admin",
    title: "Payment Approved", description: `Payment of ${amount} confirmed`,
    metadata: { amount, approvedBy: adminName },
  });
}

export function logPaymentRejected(campaignId: string, adminName: string, reason: string) {
  return logActivity({
    campaignId, type: "payment_rejected", category: "payment",
    actor: adminName, actorRole: "admin",
    title: "Payment Rejected", description: reason,
    metadata: { reason, rejectedBy: adminName },
  });
}

export function logEditorAssigned(campaignId: string, editorName: string, adminName: string) {
  return logActivity({
    campaignId, type: "editor_assigned", category: "assignment",
    actor: adminName, actorRole: "admin",
    title: "Editor Assigned", description: `${editorName} assigned to campaign`,
    metadata: { editor: editorName, assignedBy: adminName },
  });
}

export function logEditorSubmitted(campaignId: string, editorName: string, version: number, notes: string) {
  return logActivity({
    campaignId, type: "editor_submitted", category: "revision",
    actor: editorName, actorRole: "editor",
    title: `Version ${version} Uploaded`, description: notes || "Editor submitted their work",
    metadata: { editor: editorName, version: String(version) },
    version,
  });
}

export function logRevisionRequested(campaignId: string, requestedBy: string, role: "admin" | "artist", notes: string, version: number) {
  return logActivity({
    campaignId, type: "revision_requested", category: "revision",
    actor: role === "artist" ? "Artist" : requestedBy, actorRole: role,
    title: "Changes Requested", description: notes,
    metadata: { requestedBy: role === "artist" ? "Artist" : requestedBy, version: String(version) },
    version,
  });
}

export function logArtistApproved(campaignId: string, artistName: string, version: number) {
  return logActivity({
    campaignId, type: "artist_approved", category: "approval",
    actor: "Artist", actorRole: "artist",
    title: "Artist Approved ✅", description: `${artistName} approved the final version`,
    metadata: { artist: artistName, version: String(version) },
    version,
  });
}

export function logArtistReviewOpened(campaignId: string) {
  return logActivity({
    campaignId, type: "artist_review_opened", category: "system",
    actor: "Artist", actorRole: "artist",
    title: "Review Link Opened", description: "Artist opened the campaign review page",
    metadata: {},
  });
}

export function logAdminApproved(campaignId: string, adminName: string, version: number) {
  return logActivity({
    campaignId, type: "admin_approved", category: "approval",
    actor: adminName, actorRole: "admin",
    title: "Admin Approved", description: "Admin approved the edit for artist review",
    metadata: { approvedBy: adminName, version: String(version) },
    version,
  });
}

export function logCampaignScheduled(campaignId: string, scheduledDate: string, platform: string) {
  return logActivity({
    campaignId, type: "campaign_scheduled", category: "scheduling",
    actor: "Admin", actorRole: "admin",
    title: "Campaign Scheduled", description: `Scheduled on ${platform} for ${scheduledDate}`,
    metadata: { scheduledDate, platform },
  });
}

export function logTikTokSubmitted(campaignId: string, submittedBy: string, url: string) {
  return logActivity({
    campaignId, type: "tiktok_submitted", category: "posting",
    actor: submittedBy, actorRole: submittedBy === "admin" ? "admin" : "editor",
    title: "TikTok Link Submitted", description: "Post URL submitted for verification",
    metadata: { url, submittedBy },
  });
}

export function logTikTokVerified(campaignId: string, verifiedBy: string) {
  return logActivity({
    campaignId, type: "tiktok_verified", category: "posting",
    actor: verifiedBy, actorRole: "admin",
    title: "TikTok Verified ✅", description: "Post verified and marked live",
    metadata: { verifiedBy },
  });
}

export function logCampaignCompleted(campaignId: string) {
  return logActivity({
    campaignId, type: "campaign_completed", category: "approval",
    actor: "System", actorRole: "system",
    title: "Campaign Completed 🎉", description: "Campaign finished successfully",
    metadata: {},
  });
}

export function logAiAlert(campaignId: string, title: string, description: string) {
  return logActivity({
    campaignId, type: "ai_alert", category: "ai",
    actor: "AI Copilot", actorRole: "ai",
    title, description,
    metadata: {},
  });
}

export function logComment(campaignId: string, author: string, role: "admin" | "artist" | "editor", text: string) {
  return logActivity({
    campaignId, type: "comment_added", category: "comment",
    actor: author, actorRole: role,
    title: "Comment Added 💬", description: text,
    metadata: { author },
  });
}

export function logNoteAdded(campaignId: string, adminName: string, note: string) {
  return logActivity({
    campaignId, type: "note_added", category: "system",
    actor: adminName, actorRole: "admin",
    title: "Note Added", description: note,
    metadata: { addedBy: adminName },
  });
}

export function logPriorityChanged(campaignId: string, adminName: string, from: string, to: string) {
  return logActivity({
    campaignId, type: "priority_changed", category: "system",
    actor: adminName, actorRole: "admin",
    title: "Priority Changed", description: `Changed from ${from} to ${to}`,
    metadata: { from, to, changedBy: adminName },
  });
}

export function logStatusOverride(campaignId: string, adminName: string, from: string, to: string) {
  return logActivity({
    campaignId, type: "status_override", category: "system",
    actor: adminName, actorRole: "admin",
    title: "Status Changed", description: `Manually changed from "${from}" to "${to}"`,
    metadata: { from, to, changedBy: adminName },
  });
}

export function logArtistComment(campaignId: string, text: string) {
  return logActivity({
    campaignId, type: "artist_comment", category: "comment",
    actor: "Artist", actorRole: "artist",
    title: "Artist Commented 💬", description: text,
    metadata: {},
  });
}

export function clearActivityLog() {
  localStorage.removeItem(STORAGE_KEY);
}

/* ─── FILTERED GLOBAL QUERY ───────────────────────────────── */

export interface ActivityLogQuery {
  page?: number;
  pageSize?: number;
  category?: ActivityCategory | "all";
  actorRole?: ActorType | "all";
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  priorityOnly?: boolean;
  campaignId?: string;
}

const PRIORITY_EVENT_TYPES = new Set([
  "revision_requested", "artist_revision_requested", "payment_rejected",
  "status_override", "ai_alert",
]);

export function queryActivityLogs(
  options: ActivityLogQuery = {},
): { entries: ActivityEntry[]; total: number; hasMore: boolean } {
  const all = getAll();
  const {
    page = 0,
    pageSize = 25,
    category,
    actorRole,
    search,
    dateFrom,
    dateTo,
    priorityOnly,
    campaignId,
  } = options;

  let filtered = all;

  if (campaignId) {
    filtered = filtered.filter((e) =>
      e.campaignId.toLowerCase().includes(campaignId.toLowerCase()),
    );
  }

  if (category && category !== "all") {
    filtered = filtered.filter((e) => e.category === category);
  }

  if (actorRole && actorRole !== "all") {
    filtered = filtered.filter((e) => e.actorRole === actorRole);
  }

  if (priorityOnly) {
    filtered = filtered.filter((e) => PRIORITY_EVENT_TYPES.has(e.type));
  }

  if (dateFrom) {
    const from = new Date(dateFrom).getTime();
    filtered = filtered.filter((e) => new Date(e.timestamp).getTime() >= from);
  }

  if (dateTo) {
    const to = new Date(dateTo).getTime() + 86400000; // end of day
    filtered = filtered.filter((e) => new Date(e.timestamp).getTime() <= to);
  }

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter((e) =>
      e.title.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.actor.toLowerCase().includes(q) ||
      e.type.toLowerCase().includes(q) ||
      e.campaignId.toLowerCase().includes(q) ||
      Object.values(e.metadata).some((v) => v.toLowerCase().includes(q)),
    );
  }

  const total = filtered.length;
  const start = page * pageSize;
  const entries = filtered.slice(start, start + pageSize);

  return { entries, total, hasMore: start + pageSize < total };
}

/* ─── EXPORT UTILITIES ────────────────────────────────────── */

export function exportActivityLogToCSV(entries: ActivityEntry[]): string {
  const headers = [
    "Timestamp", "Campaign ID", "Type", "Category", "Actor",
    "Actor Role", "Title", "Description", "Version", "Metadata",
  ];
  const rows = entries.map((e) => [
    e.timestamp,
    e.campaignId,
    e.type,
    e.category,
    e.actor,
    e.actorRole,
    `"${e.title.replace(/"/g, '""')}"`,
    `"${e.description.replace(/"/g, '""')}"`,
    e.version ?? "",
    `"${JSON.stringify(e.metadata).replace(/"/g, '""')}"`,
  ]);
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export function exportActivityLogToJSON(entries: ActivityEntry[]): string {
  return JSON.stringify(entries, null, 2);
}

export function downloadActivityLog(
  entries: ActivityEntry[],
  format: "csv" | "json",
  filename?: string,
): void {
  const content = format === "csv"
    ? exportActivityLogToCSV(entries)
    : exportActivityLogToJSON(entries);
  const mime = format === "csv" ? "text/csv" : "application/json";
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `activity-log-${new Date().toISOString().split("T")[0]}.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ─── PDF EXPORT ──────────────────────────────────────────── */

export async function exportActivityLogToPDF(entries: ActivityEntry[]): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf") as Promise<typeof import("jspdf")>,
    import("jspdf-autotable") as Promise<{ default: (doc: any, opts: any) => void }>,
  ]);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(239, 68, 68);
  doc.text("SharpConnect — Activity Log", 14, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`, 14, 24);
  doc.text(`Total entries: ${entries.length}`, 14, 29);

  const head = [["Timestamp", "Campaign ID", "Event", "Description", "Actor", "Role", "Category"]];
  const body = entries.map((e) => [
    new Date(e.timestamp).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
    e.campaignId,
    e.title,
    e.description,
    e.actor,
    e.actorRole,
    e.category,
  ]);

  autoTable(doc, {
    head,
    body,
    startY: 33,
    theme: "grid",
    styles: { fontSize: 6, cellPadding: 1.5, font: "helvetica" },
    headStyles: { fillColor: [239, 68, 68], textColor: [255, 255, 255], fontSize: 6, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 24 },
      2: { cellWidth: 32 },
      3: { cellWidth: "auto" },
      4: { cellWidth: 22 },
      5: { cellWidth: 14 },
      6: { cellWidth: 16 },
    },
    margin: { top: 33 },
  });

  doc.save(`activity-log-${new Date().toISOString().split("T")[0]}.pdf`);
}

/* ─── DATE RANGE PRESETS ──────────────────────────────────── */

export interface DateRangePreset {
  label: string;
  days: number | null; // null = all time
}

export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  { label: "All Time", days: null },
  { label: "Today", days: 0 },
  { label: "Last 7 Days", days: 7 },
  { label: "Last 30 Days", days: 30 },
  { label: "Last 90 Days", days: 90 },
];

export function getDateRangeFromPreset(preset: DateRangePreset): { from?: string; to?: string } {
  if (preset.days === null) return {};
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - preset.days);
  from.setHours(0, 0, 0, 0);
  return {
    from: from.toISOString(),
    to: now.toISOString(),
  };
}

/* ─── AGGREGATION HELPERS ─────────────────────────────────── */

export interface ActivityStats {
  total: number;
  byCategory: Record<ActivityCategory, number>;
  byActorRole: Record<ActorType, number>;
  priorityCount: number;
  uniqueCampaigns: number;
  mostActiveActor: { name: string; count: number } | null;
}

export function computeActivityStats(entries: ActivityEntry[]): ActivityStats {
  const byCategory = {
    approval: 0, revision: 0, payment: 0, assignment: 0,
    scheduling: 0, posting: 0, system: 0, ai: 0, comment: 0,
  };
  const byActorRole = { admin: 0, artist: 0, editor: 0, ai: 0, system: 0 };
  const actorCounts = new Map<string, number>();
  const campaigns = new Set<string>();
  let priorityCount = 0;

  for (const e of entries) {
    byCategory[e.category] = (byCategory[e.category] || 0) + 1;
    byActorRole[e.actorRole] = (byActorRole[e.actorRole] || 0) + 1;
    campaigns.add(e.campaignId);
    actorCounts.set(e.actor, (actorCounts.get(e.actor) || 0) + 1);
    if (PRIORITY_EVENT_TYPES.has(e.type)) priorityCount++;
  }

  let mostActiveActor: { name: string; count: number } | null = null;
  for (const [name, count] of actorCounts) {
    if (!mostActiveActor || count > mostActiveActor.count) {
      mostActiveActor = { name, count };
    }
  }

  return {
    total: entries.length,
    byCategory: byCategory as Record<ActivityCategory, number>,
    byActorRole: byActorRole as Record<ActorType, number>,
    priorityCount,
    uniqueCampaigns: campaigns.size,
    mostActiveActor,
  };
}

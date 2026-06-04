import { supabase, isSupabaseConfigured, createAdminClient } from "./supabase";
import type { AppNotification, NotificationType } from "./notifications";

/* ─── CONSTANTS ────────────────────────────────────────── */

const TELEGRAM_API = "https://api.telegram.org/bot";
const ADMIN_CHAT_ID_KEY = "sharpconnect_admin_telegram_chat_id";

/* ─── TYPES ────────────────────────────────────────────── */

export type DispatchChannel = "telegram" | "email" | "in_app";

export interface DispatchResult {
  channel: DispatchChannel;
  recipient: string;
  status: "sent" | "failed" | "skipped";
  error?: string;
  timestamp: string;
}

export interface DispatchConfig {
  enabled: boolean;
  channels: DispatchChannel[];
}

/* ─── MESSAGE FORMATTING ───────────────────────────────── */

function formatNotificationMessage(n: AppNotification): string {
  const emoji: Partial<Record<NotificationType, string>> = {
    new_campaign: "🎵",
    payment_uploaded: "💰",
    payment_approved: "✅",
    editor_assigned: "👤",
    editor_submitted: "🎬",
    revision_requested: "🔄",
    admin_approved: "👍",
    campaign_scheduled: "📅",
    post_submitted: "📤",
    post_verified: "🔗",
    overdue_campaign: "⏰",
    campaign_completed: "🎉",
    ai_alert: "🤖",
    support_request: "💬",
    artist_approved: "✅",
    artist_revision_requested: "🔄",
    artist_review_ready: "🎨",
  };

  const icon = emoji[n.type] || "📢";
  const priorityTag = n.priority === "urgent" ? "🔴 URGENT" : n.priority === "high" ? "🟠 HIGH" : "";

  const lines: string[] = [
    `${icon} *${n.title}*`,
    ``,
    n.message,
  ];

  if (priorityTag) {
    lines.push(``, priorityTag);
  }

  if (n.campaignId) {
    const base = process.env.NEXT_PUBLIC_SITE_URL || "https://sharpconnect.vercel.app";
    lines.push(``, `Campaign: ${n.campaignId}`);
    lines.push(`Admin: ${base}/admin/campaigns?campaign=${n.campaignId}`);
  }

  if (n.triggeredBy) {
    lines.push(`By: ${n.triggeredBy}`);
  }

  lines.push(``, `🕐 ${new Date(n.createdAt).toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  })}`);

  return lines.join("\n");
}

/* ─── TELEGRAM SEND ─────────────────────────────────────── */

export async function sendTelegramMessage(
  chatId: string,
  text: string,
  options?: { parseMode?: "HTML" | "Markdown"; disableWebPagePreview?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN not configured" };

  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: options?.parseMode || "Markdown",
      disable_web_page_preview: options?.disableWebPagePreview ?? true,
    };

    const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!data.ok) {
      return { ok: false, error: data.description || "Telegram API error" };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/* ─── DISPATCH TO TELEGRAM ──────────────────────────────── */

export async function dispatchToTelegram(
  notification: AppNotification,
  chatId: string,
): Promise<DispatchResult> {
  const text = formatNotificationMessage(notification);

  // Validate chat ID looks reasonable
  if (!chatId || chatId.length < 2) {
    return {
      channel: "telegram",
      recipient: chatId,
      status: "skipped",
      error: "Invalid chat ID",
      timestamp: new Date().toISOString(),
    };
  }

  const result = await sendTelegramMessage(chatId, text);

  return {
    channel: "telegram",
    recipient: chatId,
    status: result.ok ? "sent" : "failed",
    error: result.error,
    timestamp: new Date().toISOString(),
  };
}

/* ─── DISPATCH LOGGING ──────────────────────────────────── */

export async function logDispatch(
  result: DispatchResult,
  notification: AppNotification,
): Promise<void> {
  try {
    const client = createAdminClient();
    if (!client || !isSupabaseConfigured) return;

    await client.from("notification_logs").insert({
      campaign_id: notification.campaignId || null,
      channel: result.channel,
      recipient: result.recipient,
      subject: notification.title,
      body: notification.message,
      status: result.status === "sent" ? "sent" : `failed: ${result.error || "unknown"}`,
    });
  } catch (err) {
    console.error("[dispatch] log failed:", err);
  }
}

/* ─── RESOLVE RECIPIENTS ────────────────────────────────── */

export function getAdminTelegramChatId(): string {
  if (typeof window !== "undefined") {
    return sessionStorage.getItem(ADMIN_CHAT_ID_KEY) || "";
  }
  return process.env.TELEGRAM_STORAGE_CHAT_ID || "";
}

export function setAdminTelegramChatId(chatId: string): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(ADMIN_CHAT_ID_KEY, chatId);
  }
}

export function getEditorTelegramChatId(editorTelegram: string): string {
  if (!editorTelegram) return "";
  const clean = editorTelegram.trim();
  // If it's a @username, use directly
  if (clean.startsWith("@")) return clean;
  // If it's a phone number (digits only), can't send via Bot API without prior contact
  const digits = clean.replace(/[^0-9]/g, "");
  if (digits.length >= 10) return ""; // phone numbers not supported for bot-initiated messages
  return clean;
}

/* ─── MAIN DISPATCH ─────────────────────────────────────── */

export async function dispatchNotification(
  notification: AppNotification,
): Promise<DispatchResult[]> {
  const results: DispatchResult[] = [];

  // Telegram: send to admin group chat
  const adminChatId = getAdminTelegramChatId();
  if (adminChatId) {
    const r = await dispatchToTelegram(notification, adminChatId);
    results.push(r);
    await logDispatch(r, notification);
  }

  return results;
}

/* ─── CLIENT-SIDE DISPATCH TRIGGER ──────────────────────── */

export async function triggerDispatch(notification: AppNotification): Promise<void> {
  try {
    await fetch("/api/notifications/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(notification),
    });
  } catch {
    // Fire-and-forget: don't block the notification flow
  }
}

/* ─── DISPATCH SETTINGS ─────────────────────────────────── */

export function getDispatchEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem("sharpconnect_dispatch_enabled") !== "false";
}

export function setDispatchEnabled(enabled: boolean): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("sharpconnect_dispatch_enabled", String(enabled));
  }
}

export function getDispatchChannelEnabled(channel: DispatchChannel): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(`sharpconnect_dispatch_channel_${channel}`) !== "false";
}

export function setDispatchChannelEnabled(channel: DispatchChannel, enabled: boolean): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(`sharpconnect_dispatch_channel_${channel}`, String(enabled));
  }
}
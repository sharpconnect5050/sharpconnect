import { supabase, isSupabaseConfigured } from "./supabase";

export interface ArtistNotification {
  id: string;
  campaignId: string;
  type: "payment_approved" | "campaign_started" | "campaign_completed" | "editor_submitted" | "revision_requested" | "admin_approved" | "status_update" | "artist_review_ready" | "artist_revision_requested" | "artist_approved";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

function lsGetAll(): ArtistNotification[] {
  try {
    const raw = localStorage.getItem("sharpconnect_artist_notifications");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function lsSaveAll(notifs: ArtistNotification[]) {
  try {
    localStorage.setItem("sharpconnect_artist_notifications", JSON.stringify(notifs));
  } catch {}
}

export async function addArtistNotification(campaignId: string, type: ArtistNotification["type"], title: string, message: string) {
  const notif: ArtistNotification = {
    id: `art-ntf-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    campaignId,
    type,
    title,
    message,
    timestamp: new Date().toISOString(),
    read: false,
  };

  if (isSupabaseConfigured) {
    try {
      await supabase.from("artist_notifications").insert({
        campaign_id: campaignId,
        type,
        title,
        message,
        read_status: false,
      });
    } catch (e) { console.error("[addArtistNotification] insert failed:", e); }
  }

  const all = lsGetAll();
  all.unshift(notif);
  lsSaveAll(all);
}

export function getArtistNotifications(campaignId?: string): ArtistNotification[] {
  const all = lsGetAll();
  if (campaignId) return all.filter((n) => n.campaignId === campaignId);
  return all;
}

export async function markArtistNotificationsRead(campaignId: string) {
  if (isSupabaseConfigured) {
    try {
      await supabase.from("artist_notifications").update({ read_status: true }).eq("campaign_id", campaignId).eq("read_status", false);
    } catch (e) { console.error("[markArtistNotificationsRead] update failed:", e); }
  }
  const all = lsGetAll();
  all.forEach((n) => {
    if (n.campaignId === campaignId) n.read = true;
  });
  lsSaveAll(all);
}

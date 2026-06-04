import { supabase, isSupabaseConfigured } from "./supabase";
import { isServerAvailable, apiGet, apiGetById, apiUpsert, apiInsert, apiUpdate } from "./data-api";
import type { CampaignRow } from "./database.types";

export interface Campaign {
  campaignId: string;
  status: CampaignStatus;
  submittedAt: string;
  artistName: string;
  songTitle: string;
  tiktokHandle: string;
  instagramHandle: string;
  whatsapp: string;
  email: string;
  packageId: string;
  packageName: string;
  packagePrice: number;
  soundOption: string;
  soundFee: number;
  total: number;
  creativeDirection: string;
  selectedTags: string[];
  hasAudio: boolean;
  hasVideo: boolean;
  senderName: string;
  senderNumber: string;
  amountSent: string;
  transactionId: string;
  paymentMethod: string;
  editor: string;
  priority: "Low" | "Medium" | "High" | "Urgent";
  notes: string;
  audioUrl: string;
  videoUrl: string;
  tiktokSoundLink: string;
}

export type CampaignStatus =
  | "Pending Verification"
  | "Paid"
  | "Assigned"
  | "Editing"
  | "Pending Admin Review"
  | "Needs Revision"
  | "Approved"
  | "Pending Artist Review"
  | "Artist Revision Requested"
  | "Approved By Artist"
  | "Ready To Schedule"
  | "Template Created"
  | "Scheduled"
  | "Posted"
  | "Completed"
  | "Rejected";

function rowToCampaign(row: CampaignRow): Campaign {
  return {
    campaignId: row.campaign_id,
    status: row.campaign_status as CampaignStatus,
    submittedAt: row.created_at,
    artistName: row.artist_name || "",
    songTitle: row.song_title || "",
    tiktokHandle: row.tiktok_handle,
    instagramHandle: row.instagram_handle,
    whatsapp: row.whatsapp,
    email: row.email,
    packageId: row.package_id,
    packageName: row.package_name,
    packagePrice: row.package_price,
    soundOption: row.sound_option,
    soundFee: row.sound_fee,
    total: row.total,
    creativeDirection: row.creative_direction,
    selectedTags: row.selected_tags || [],
    hasAudio: row.has_audio,
    hasVideo: row.has_video,
    senderName: row.sender_name,
    senderNumber: row.sender_number,
    amountSent: row.amount_sent,
    transactionId: row.transaction_id,
    paymentMethod: row.payment_method,
    editor: row.editor,
    priority: (row.priority as Campaign["priority"]) || "Medium",
    notes: row.notes || "",
    audioUrl: row.audio_url || "",
    videoUrl: row.video_url || "",
    tiktokSoundLink: row.tiktok_sound_link || "",
  };
}

// ─── LOCALSTORAGE HELPERS (FALLBACK) ─────────────────────────

function lsGetCampaigns(): Campaign[] {
  try {
    const raw = localStorage.getItem("sharpconnect_submissions");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function lsSetCampaigns(data: Campaign[]) {
  try {
    localStorage.setItem("sharpconnect_submissions", JSON.stringify(data));
  } catch {}
}

// ─── GET CAMPAIGNS ────────────────────────────────────────────

export async function getCampaigns(limit?: number): Promise<Campaign[]> {
  try {
    if (await isServerAvailable()) {
      const data = await apiGet<any>("campaigns");
      const campaigns = data.map(rowToCampaign);
      if (campaigns.length > 0) return limit ? campaigns.slice(0, limit) : campaigns;
    }
  } catch {}
  if (isSupabaseConfigured) {
    let query = supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (!error && data) return data.map(rowToCampaign);
  }
  const all = lsGetCampaigns();
  return limit ? all.slice(0, limit) : all;
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  try {
    if (await isServerAvailable()) {
      const data = await apiGet<any>("campaigns", { key: "campaignId", value: id });
      if (data && data.length > 0) return rowToCampaign(data[0]);
    }
  } catch {}
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("campaign_id", id)
      .single();
    if (!error && data) return rowToCampaign(data);
  }
  const all = lsGetCampaigns();
  return all.find((c) => c.campaignId === id) || null;
}

// ─── UPDATE CAMPAIGN ──────────────────────────────────────────

export async function updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign[]> {
  try {
    if (await isServerAvailable()) {
      await apiUpdate("campaigns", id, updates);
    }
  } catch {}
  if (isSupabaseConfigured) {
    const dbUpdates: Record<string, any> = {};
    if (updates.status !== undefined) {
      dbUpdates.campaign_status = updates.status;
      dbUpdates.payment_status = updates.status;
    }
    if (updates.editor !== undefined) dbUpdates.editor = updates.editor;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.senderName !== undefined) dbUpdates.sender_name = updates.senderName;
    if (updates.senderNumber !== undefined) dbUpdates.sender_number = updates.senderNumber;
    if (updates.amountSent !== undefined) dbUpdates.amount_sent = updates.amountSent;
    if (updates.transactionId !== undefined) dbUpdates.transaction_id = updates.transactionId;
    if (updates.paymentMethod !== undefined) dbUpdates.payment_method = updates.paymentMethod;
    if (updates.artistName !== undefined) dbUpdates.artist_name = updates.artistName;
    if (updates.songTitle !== undefined) dbUpdates.song_title = updates.songTitle;
    if (updates.tiktokHandle !== undefined) dbUpdates.tiktok_handle = updates.tiktokHandle;
    if (updates.instagramHandle !== undefined) dbUpdates.instagram_handle = updates.instagramHandle;
    if (updates.whatsapp !== undefined) dbUpdates.whatsapp = updates.whatsapp;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.packageId !== undefined) dbUpdates.package_id = updates.packageId;
    if (updates.packageName !== undefined) dbUpdates.package_name = updates.packageName;
    if (updates.packagePrice !== undefined) dbUpdates.package_price = updates.packagePrice;
    if (updates.soundOption !== undefined) dbUpdates.sound_option = updates.soundOption;
    if (updates.soundFee !== undefined) dbUpdates.sound_fee = updates.soundFee;
    if (updates.total !== undefined) dbUpdates.total = updates.total;
    if (updates.creativeDirection !== undefined) dbUpdates.creative_direction = updates.creativeDirection;
    if (updates.selectedTags !== undefined) dbUpdates.selected_tags = updates.selectedTags;
    if (updates.hasAudio !== undefined) dbUpdates.has_audio = updates.hasAudio;
    if (updates.hasVideo !== undefined) dbUpdates.has_video = updates.hasVideo;
    if (updates.audioUrl !== undefined) dbUpdates.audio_url = updates.audioUrl;
    if (updates.videoUrl !== undefined) dbUpdates.video_url = updates.videoUrl;
    if (updates.tiktokSoundLink !== undefined) dbUpdates.tiktok_sound_link = updates.tiktokSoundLink;
    await supabase.from("campaigns").update(dbUpdates).eq("campaign_id", id);
  }

  const campaigns = lsGetCampaigns();
  const updated = campaigns.map((c) => (c.campaignId === id ? { ...c, ...updates } : c));
  lsSetCampaigns(updated);
  return updated;
}

export async function refreshCampaigns(): Promise<Campaign[]> {
  return getCampaigns();
}

// ─── SAVE CAMPAIGN (CREATE) ───────────────────────────────────

export async function saveCampaign(data: {
  campaignId: string;
  status: string;
  submittedAt: string;
  [key: string]: any;
}): Promise<void> {
  const campaign = {
    id: data.campaignId,
    campaignId: data.campaignId,
    status: (data.status || "Pending Verification") as CampaignStatus,
    submittedAt: data.submittedAt || new Date().toISOString(),
    artistName: data.artistName || "",
    songTitle: data.songTitle || "",
    tiktokHandle: data.tiktokHandle || "",
    instagramHandle: data.instagramHandle || "",
    whatsapp: data.whatsapp || "",
    email: data.email || "",
    packageId: data.packageId || "",
    packageName: data.packageName || "",
    packagePrice: data.packagePrice || 0,
    soundOption: data.soundOption || "original",
    soundFee: data.soundFee || 0,
    total: data.total || 0,
    creativeDirection: data.creativeDirection || "",
    selectedTags: data.selectedTags || [],
    hasAudio: data.hasAudio || false,
    hasVideo: data.hasVideo || false,
    senderName: data.senderName || "",
    senderNumber: data.senderNumber || "",
    amountSent: data.amountSent || "",
    transactionId: data.transactionId || "",
    paymentMethod: data.paymentMethod || "",
    editor: data.editor || "Unassigned",
    priority: (data.priority || "Medium") as Campaign["priority"],
    notes: data.notes || "",
    audioUrl: data.audioUrl || "",
    videoUrl: data.videoUrl || "",
    tiktokSoundLink: data.tiktokSoundLink || "",
  };

  try {
    if (await isServerAvailable()) {
      await apiUpsert("campaigns", campaign);
    }
  } catch {}

  if (isSupabaseConfigured) {
    const { error } = await supabase.from("campaigns").insert({
      campaign_id: data.campaignId,
      artist_name: data.artistName || "",
      song_title: data.songTitle || "",
      tiktok_handle: data.tiktokHandle || "",
      instagram_handle: data.instagramHandle || "",
      whatsapp: data.whatsapp || "",
      email: data.email || "",
      package_id: data.packageId || "",
      package_name: data.packageName || "",
      package_price: data.packagePrice || 0,
      sound_option: data.soundOption || "original",
      sound_fee: data.soundFee || 0,
      total: data.total || 0,
      creative_direction: data.creativeDirection || "",
      selected_tags: data.selectedTags || [],
      has_audio: data.hasAudio || false,
      has_video: data.hasVideo || false,
      sender_name: data.senderName || "",
      sender_number: data.senderNumber || "",
      amount_sent: data.amountSent || "",
      transaction_id: data.transactionId || "",
      payment_method: data.paymentMethod || "",
      audio_url: data.audioUrl || "",
      video_url: data.videoUrl || "",
      tiktok_sound_link: data.tiktokSoundLink || "",
      campaign_status: data.status || "Pending Verification",
      payment_status: data.status || "Pending Verification",
      created_at: data.submittedAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(`Failed to save campaign: ${error.message}`);
  }

  const existing = lsGetCampaigns();
  existing.push(campaign);
  lsSetCampaigns(existing);
}

// ─── STATS ────────────────────────────────────────────────────

export function getStats(campaigns: Campaign[]) {
  return {
    total: campaigns.length,
    paid: campaigns.filter((c) => c.status === "Paid").length,
    pendingVerification: campaigns.filter((c) => c.status === "Pending Verification").length,
    pendingReview: campaigns.filter((c) => c.status === "Pending Admin Review").length,
    inProduction: campaigns.filter((c) => ["Assigned", "Editing", "Pending Admin Review", "Needs Revision", "Pending Artist Review", "Artist Revision Requested", "Approved By Artist", "Ready To Schedule", "Template Created", "Scheduled"].includes(c.status)).length,
    completed: campaigns.filter((c) => c.status === "Completed").length,
    revenue: campaigns.filter((c) => c.status !== "Pending Verification" && c.status !== "Rejected").reduce((sum, c) => sum + c.total, 0),
  };
}

// ─── FORMATTERS ───────────────────────────────────────────────

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatCurrency(amount: number) {
  return `GHC ${amount.toLocaleString()}`;
}

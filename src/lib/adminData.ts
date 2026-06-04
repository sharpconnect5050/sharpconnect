import { isServerAvailable, apiGet, apiUpsert, apiUpdate } from "./data-api";

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

function rowToCampaign(row: Record<string, any>): Campaign {
  return {
    campaignId: row.campaignId ?? row.campaign_id,
    status: row.status ?? row.campaign_status,
    submittedAt: row.submittedAt ?? row.created_at,
    artistName: row.artistName ?? row.artist_name ?? "",
    songTitle: row.songTitle ?? row.song_title ?? "",
    tiktokHandle: row.tiktokHandle ?? row.tiktok_handle,
    instagramHandle: row.instagramHandle ?? row.instagram_handle,
    whatsapp: row.whatsapp,
    email: row.email,
    packageId: row.packageId ?? row.package_id,
    packageName: row.packageName ?? row.package_name,
    packagePrice: row.packagePrice ?? row.package_price,
    soundOption: row.soundOption ?? row.sound_option,
    soundFee: row.soundFee ?? row.sound_fee,
    total: row.total,
    creativeDirection: row.creativeDirection ?? row.creative_direction,
    selectedTags: row.selectedTags ?? row.selected_tags ?? [],
    hasAudio: row.hasAudio ?? row.has_audio,
    hasVideo: row.hasVideo ?? row.has_video,
    senderName: row.senderName ?? row.sender_name,
    senderNumber: row.senderNumber ?? row.sender_number,
    amountSent: row.amountSent ?? row.amount_sent,
    transactionId: row.transactionId ?? row.transaction_id,
    paymentMethod: row.paymentMethod ?? row.payment_method,
    editor: row.editor,
    priority: (row.priority || "Medium") as Campaign["priority"],
    notes: row.notes ?? "",
    audioUrl: row.audioUrl ?? row.audio_url ?? "",
    videoUrl: row.videoUrl ?? row.video_url ?? "",
    tiktokSoundLink: row.tiktokSoundLink ?? row.tiktok_sound_link ?? "",
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
  let campaigns: Campaign[] = [];
  try {
    if (await isServerAvailable()) {
      const data = await apiGet<any>("campaigns");
      campaigns = data.map(rowToCampaign);
    }
  } catch (e) { console.error("[adminData] getCampaigns API failed:", e); }
  if (campaigns.length === 0) {
    campaigns = lsGetCampaigns();
  }
  return limit ? campaigns.slice(0, limit) : campaigns;
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  try {
    if (await isServerAvailable()) {
      const data = await apiGet<any>("campaigns", { key: "campaignId", value: id });
      if (data && data.length > 0) return rowToCampaign(data[0]);
    }
  } catch (e) { console.error("[adminData] getCampaign API failed:", e); }
  const all = lsGetCampaigns();
  return all.find((c) => c.campaignId === id) || null;
}

// ─── UPDATE CAMPAIGN ──────────────────────────────────────────

export async function updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign[]> {
  try {
    if (await isServerAvailable()) {
      await apiUpdate("campaigns", id, updates);
    }
  } catch (e) { console.error("[adminData] updateCampaign API failed:", e); }

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
  } catch (e) { console.error("[adminData] saveCampaign API upsert failed:", e); }

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

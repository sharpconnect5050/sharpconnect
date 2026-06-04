import { isServerAvailable, apiSetAll } from "./data-api";

export interface ReviewAction {
  id: string;
  campaignId: string;
  editorId: string;
  action: "approved" | "revision_requested";
  timestamp: string;
  adminNotes?: string;
}

export interface ReviewStats {
  campaignId: string;
  totalSubmissions: number;
  revisionCount: number;
  approvedAt?: string;
  lastReviewedAt?: string;
  reviewerName?: string;
}

const REVIEWS_KEY = "sharpconnect_review_history";

function getReviews(): ReviewAction[] {
  try {
    const raw = localStorage.getItem(REVIEWS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveReviews(reviews: ReviewAction[]) {
  try {
    localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
    syncReviewsToServer(reviews);
  } catch {}
}

async function syncReviewsToServer(reviews: ReviewAction[]) {
  try { if (await isServerAvailable()) await apiSetAll("review_history", reviews); } catch {}
}

export function logReviewAction(
  campaignId: string,
  editorId: string,
  action: "approved" | "revision_requested",
  adminNotes?: string
): ReviewAction {
  const review: ReviewAction = {
    id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    campaignId,
    editorId,
    action,
    timestamp: new Date().toISOString(),
    adminNotes,
  };
  const all = getReviews();
  all.unshift(review);
  saveReviews(all);
  return review;
}

export function getCampaignReviewHistory(campaignId: string): ReviewAction[] {
  return getReviews().filter((r) => r.campaignId === campaignId);
}

export function getAllReviewHistory(): ReviewAction[] {
  return getReviews();
}

export function getCampaignReviewStats(campaignId: string): ReviewStats {
  const history = getCampaignReviewHistory(campaignId);
  const approved = history.find((r) => r.action === "approved");
  return {
    campaignId,
    totalSubmissions: history.length,
    revisionCount: history.filter((r) => r.action === "revision_requested").length,
    approvedAt: approved?.timestamp,
    lastReviewedAt: history[0]?.timestamp,
  };
}

export function getPendingReviewCount(): number {
  return getReviews().filter((r) => r.action === "revision_requested").length;
}

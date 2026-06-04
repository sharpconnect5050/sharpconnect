import { getCampaignSubmission } from "./editors";
import { isServerAvailable, apiSetAll } from "./data-api";

const REVIEW_KEY = "sharpconnect_artist_reviews";
const TOKEN_KEY = "sharpconnect_review_tokens";
const COMMENTS_KEY = "sharpconnect_review_comments";

/* ─── TYPES ───────────────────────────────────────────────── */

export interface ArtistReviewEntry {
  id: string;
  campaignId: string;
  version: number;
  action: "approved" | "revision_requested" | "comment";
  comment: string;
  createdAt: string;
}

export interface ArtistVersionRecord {
  campaignId: string;
  version: number;
  editorSubmissionId: string;
  editorNotes: string;
  files: { fileType: string; fileName: string; fileUrl: string }[];
  submittedAt: string;
  artistReview?: {
    action: "approved" | "revision_requested";
    comment: string;
    reviewedAt: string;
  };
}

export interface ReviewToken {
  token: string;
  campaignId: string;
  status: "active" | "expired";
  createdAt: string;
  lastAccessedAt: string;
}

export interface ReviewComment {
  id: string;
  token: string;
  campaignId: string;
  text: string;
  timestampSeconds: number | null;
  version: number;
  author: "artist" | "admin";
  createdAt: string;
}

/* ─── TOKEN GENERATION ───────────────────────────────────── */

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += chars[random[i] % chars.length];
  }
  return result;
}

function getAllTokens(): ReviewToken[] {
  try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || "[]"); } catch { return []; }
}

function saveAllTokens(tokens: ReviewToken[]) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  syncTokensToServer(tokens);
}

async function syncTokensToServer(tokens: ReviewToken[]) {
  try { if (await isServerAvailable()) await apiSetAll("review_tokens", tokens); } catch {}
}

export function createReviewToken(campaignId: string): ReviewToken {
  const tokens = getAllTokens();
  const existing = tokens.find((t) => t.campaignId === campaignId && t.status === "active");
  if (existing) return existing;

  const token: ReviewToken = {
    token: generateToken(),
    campaignId,
    status: "active",
    createdAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
  };
  tokens.push(token);
  saveAllTokens(tokens);
  return token;
}

export function getCampaignByToken(token: string): ReviewToken | null {
  const tokens = getAllTokens();
  return tokens.find((t) => t.token === token && t.status === "active") || null;
}

export function getReviewTokenByCampaign(campaignId: string): ReviewToken | null {
  return getAllTokens().find((t) => t.campaignId === campaignId) || null;
}

export function touchToken(token: string) {
  const tokens = getAllTokens();
  const found = tokens.find((t) => t.token === token);
  if (found) {
    found.lastAccessedAt = new Date().toISOString();
    saveAllTokens(tokens);
  }
}

/* ─── REVIEWS (artist actions) ───────────────────────────── */

function getAllReviews(): ArtistReviewEntry[] {
  try { return JSON.parse(localStorage.getItem(REVIEW_KEY) || "[]"); } catch { return []; }
}

function saveAllReviews(reviews: ArtistReviewEntry[]) {
  localStorage.setItem(REVIEW_KEY, JSON.stringify(reviews));
  syncReviewsToServer(reviews);
}

async function syncReviewsToServer(reviews: ArtistReviewEntry[]) {
  try { if (await isServerAvailable()) await apiSetAll("artist_reviews", reviews); } catch {}
}

export function addArtistReview(entry: Omit<ArtistReviewEntry, "id" | "createdAt">): ArtistReviewEntry {
  const reviews = getAllReviews();
  const newEntry: ArtistReviewEntry = {
    ...entry,
    id: `arv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  reviews.unshift(newEntry);
  saveAllReviews(reviews);
  return newEntry;
}

export function getArtistReviews(campaignId: string): ArtistReviewEntry[] {
  return getAllReviews().filter((r) => r.campaignId === campaignId);
}

export function getCampaignsPendingArtistApproval(): string[] {
  const reviews = getAllReviews();
  const latestByCampaign = new Map<string, ArtistReviewEntry>();
  for (const r of reviews) {
    const existing = latestByCampaign.get(r.campaignId);
    if (!existing || r.createdAt > existing.createdAt) {
      latestByCampaign.set(r.campaignId, r);
    }
  }
  const approved = new Set(
    [...latestByCampaign.values()]
      .filter((r) => r.action === "approved")
      .map((r) => r.campaignId)
  );
  const allWithReviews = new Set(reviews.map((r) => r.campaignId));
  return [...allWithReviews].filter((id) => !approved.has(id));
}

/* ─── VERSIONS ───────────────────────────────────────────── */

export function getArtistReviewHistory(campaignId: string): ArtistVersionRecord[] {
  try { return JSON.parse(localStorage.getItem(`sharpconnect_versions_${campaignId}`) || "[]"); } catch { return []; }
}

export function saveArtistVersionRecord(campaignId: string, record: ArtistVersionRecord) {
  const history = getArtistReviewHistory(campaignId);
  const existing = history.findIndex((h) => h.version === record.version);
  if (existing >= 0) {
    history[existing] = record;
  } else {
    history.push(record);
  }
  localStorage.setItem(`sharpconnect_versions_${campaignId}`, JSON.stringify(history));
}

export function promoteEditorSubmissionToVersion(campaignId: string) {
  const sub = getCampaignSubmission(campaignId);
  if (!sub) return;
  const history = getArtistReviewHistory(campaignId);
  const version = history.length + 1;
  const record: ArtistVersionRecord = {
    campaignId,
    version,
    editorSubmissionId: sub.taskId,
    editorNotes: sub.notes || "",
    files: sub.files.map((f) => ({
      fileType: f.fileType,
      fileName: f.fileName,
      fileUrl: f.fileUrl,
    })),
    submittedAt: sub.submittedAt,
  };
  saveArtistVersionRecord(campaignId, record);
}

/* ─── COMMENTS ───────────────────────────────────────────── */

export function addReviewComment(comment: Omit<ReviewComment, "id" | "createdAt">): ReviewComment {
  const comments = getAllComments();
  const newComment: ReviewComment = {
    ...comment,
    id: `rc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  comments.push(newComment);
  localStorage.setItem(COMMENTS_KEY, JSON.stringify(comments));
  syncCommentsToServer(comments);
  return newComment;
}

async function syncCommentsToServer(comments: ReviewComment[]) {
  try { if (await isServerAvailable()) await apiSetAll("review_comments", comments); } catch {}
}

function getAllComments(): ReviewComment[] {
  try { return JSON.parse(localStorage.getItem(COMMENTS_KEY) || "[]"); } catch { return []; }
}

export function getReviewComments(campaignId: string): ReviewComment[] {
  return getAllComments().filter((c) => c.campaignId === campaignId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

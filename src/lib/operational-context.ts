"use client";

import { getAllPendingSubmissions, getAllReviewedSubmissions, EDITORS, getEditorAssignments, getEditorByCampaignEditor } from "./editors";
import { getAllReviewHistory } from "./reviews";
import { getAllSchedules, getTodaySchedules, getOverdueSchedules, getSchedulesByStatus, getMissingLinkSchedules, getPendingVerificationSchedules } from "./scheduling";
import { getOperationalSummary } from "./notifications";
import { formatCurrency } from "./adminData";
import type { Campaign } from "./adminData";

/* ─── TYPES ───────────────────────────────────────────────── */

export type AlertPriority = "critical" | "warning" | "normal" | "info";

export interface OperationalAlert {
  id: string;
  priority: AlertPriority;
  title: string;
  message: string;
  campaignId?: string;
  actionLabel?: string;
  actionUrl?: string;
  timestamp: string;
  dismissed?: boolean;
}

export interface CampaignBrief {
  campaignId: string;
  artistName: string;
  songTitle: string;
  status: string;
  editor?: string;
  submittedAt: string;
  total: number;
  priority?: string;
}

export interface EditorWorkload {
  editorId: string;
  name: string;
  brand: string;
  activeCampaigns: number;
  role: string;
}

export interface ScheduleBrief {
  id: string;
  campaignId: string;
  platformName: string;
  scheduledDate: string;
  scheduledTime: string;
  status: string;
  assignedPoster: string;
  url?: string;
}

export interface OperationalContext {
  generatedAt: string;
  campaigns: {
    total: number;
    byStatus: Record<string, number>;
    pendingPayment: CampaignBrief[];
    editing: CampaignBrief[];
    pendingAdminReview: CampaignBrief[];
    pendingArtistApproval: CampaignBrief[];
    artistRevisionRequested: CampaignBrief[];
    readyToSchedule: CampaignBrief[];
    overdueForReview: CampaignBrief[];
    unpaid: CampaignBrief[];
    unassigned: CampaignBrief[];
  };
  schedules: {
    total: number;
    today: ScheduleBrief[];
    overdue: ScheduleBrief[];
    missingTikTokLinks: ScheduleBrief[];
    pendingVerification: ScheduleBrief[];
    posted: number;
    thisWeek: number;
  };
  editors: {
    total: number;
    workload: EditorWorkload[];
    pendingSubmissions: number;
  };
  payments: {
    pendingVerification: number;
    amountMismatches: number;
    rejected: number;
    totalPendingAmount: number;
    amountMismatchDetails: string[];
  };
  reviews: {
    total: number;
    recentActions: string[];
    campaignsWithRevisions: number;
    pendingRevisionCount: number;
  };
  notifications: {
    unread: number;
    urgent: number;
    summary: string[];
  };
  alerts: OperationalAlert[];
}

/* ─── HELPERS ─────────────────────────────────────────────── */

function genAlertId(): string {
  return `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function isOverdueHours(dateStr: string, hours: number): boolean {
  return Date.now() - new Date(dateStr).getTime() > hours * 3600000;
}

/* ─── BUILD CONTEXT ───────────────────────────────────────── */

export function buildOperationalContext(): OperationalContext {
  const now = new Date().toISOString();

  // ── Campaigns ──
  let allCampaigns: Campaign[] = [];
  try {
    const raw = localStorage.getItem("sharpconnect_submissions");
    allCampaigns = raw ? JSON.parse(raw) : [];
  } catch {}

  const byStatus: Record<string, number> = {};
  for (const c of allCampaigns) {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
  }

  const toBrief = (c: Campaign): CampaignBrief => ({
    campaignId: c.campaignId, artistName: c.artistName, songTitle: c.songTitle,
    status: c.status, editor: c.editor, submittedAt: c.submittedAt,
    total: c.total, priority: c.priority,
  });

  // Check for overdue submissions (no review in 48h+)
  const pendingSubs = getAllPendingSubmissions();
  const overdueForReview = pendingSubs
    .filter((s) => isOverdueHours(s.submittedAt, 48))
    .map((s) => {
      const c = allCampaigns.find((x) => x.campaignId === s.campaignId);
      return c ? toBrief(c) : null;
    })
    .filter(Boolean) as CampaignBrief[];

  // ── Editor submissions ──
  const pendingReviewCount = pendingSubs.length;

  // ── Schedules ──
  const allSchedules = getAllSchedules();
  const todayScheds = getTodaySchedules();
  const overdueScheds = getOverdueSchedules();
  const postedScheds = getSchedulesByStatus("Posted");
  const missingLinkScheds = getMissingLinkSchedules();
  const pendingVerifScheds = getPendingVerificationSchedules();

  const todayBrief = todayScheds.map((s) => ({
    id: s.id, campaignId: s.campaignId, platformName: s.platformName,
    scheduledDate: s.scheduledDate, scheduledTime: s.scheduledTime,
    status: s.postingStatus, assignedPoster: s.assignedPoster, url: s.postUrl,
  }));

  const schedBrief = (list: typeof allSchedules): ScheduleBrief[] =>
    list.slice(0, 10).map((s) => ({
      id: s.id, campaignId: s.campaignId, platformName: s.platformName,
      scheduledDate: s.scheduledDate, scheduledTime: s.scheduledTime,
      status: s.postingStatus, assignedPoster: s.assignedPoster, url: s.postUrl,
    }));

  // ── Editors workload ──
  const editorWorkload = EDITORS.map((e) => ({
    editorId: e.id, name: e.name, brand: e.brand,
    activeCampaigns: getEditorAssignments(e.id).length,
    role: e.role,
  }));

  // ── Payments ──
  const pendingPayments = allCampaigns.filter((c) => c.status === "Pending Verification");
  const amountMismatches = pendingPayments.filter((c) => {
    const sent = parseFloat(String(c.amountSent || "0").replace(/[^0-9.]/g, ""));
    return sent > 0 && Math.abs(sent - (c.total || 0)) > 0.01;
  });
  const mismatchDetails = amountMismatches.map((c) =>
    `${c.campaignId}: expected ${formatCurrency(c.total || 0)}, sent ${c.amountSent || "?"}`
  );
  const totalPendingAmount = pendingPayments.reduce((sum, c) => sum + (c.total || 0), 0);

  // ── Reviews ──
  const allReviews = getAllReviewHistory();
  const revisionCount = allReviews.filter((r) => r.action === "revision_requested").length;
  const campaignIdsWithRevisions = new Set(
    allReviews.filter((r) => r.action === "revision_requested").map((r) => r.campaignId)
  );

  // ── Notifications summary ──
  const notifSummary = getOperationalSummary();

  // ── Unassigned campaigns ──
  const unassigned = allCampaigns
    .filter((c) => !c.editor || c.editor === "Unassigned")
    .filter((c) => c.status !== "Completed" && c.status !== "Rejected")
    .map(toBrief);

  /* ─── ALERTS ───────────────────────────────────────────── */

  const alerts: OperationalAlert[] = [];

  // Critical: overdue edits (48h+ without review)
  for (const c of overdueForReview) {
    alerts.push({
      id: genAlertId(), priority: "critical",
      title: "Overdue Edit — No Review in 48h+",
      message: `${c.artistName} — ${c.campaignId} has been waiting for admin review for over 48 hours.`,
      campaignId: c.campaignId, timestamp: now,
    });
  }

  // Critical: overdue posts
  for (const s of overdueScheds.slice(0, 5)) {
    const c = allCampaigns.find((x) => x.campaignId === s.campaignId);
    alerts.push({
      id: genAlertId(), priority: "critical",
      title: "Overdue Post",
      message: `${s.campaignId}${c ? ` (${c.artistName})` : ""} was due ${s.scheduledDate} on ${s.platformName}.`,
      campaignId: s.campaignId, timestamp: now,
    });
  }

  // Warning: pending artist approval for 3+ days
  const pendingArtist = allCampaigns.filter((c) => c.status === "Pending Artist Review");
  for (const c of pendingArtist) {
    if (isOverdueHours(c.submittedAt, 72)) {
      alerts.push({
        id: genAlertId(), priority: "warning",
        title: "Artist Approval Stalled",
        message: `${c.artistName} hasn't reviewed ${c.campaignId} in 3+ days. Follow up via WhatsApp.`,
        campaignId: c.campaignId, timestamp: now,
      });
    }
  }

  // Warning: missing TikTok links for today's posts
  const todayMissingLinks = todayScheds.filter((s) => !s.postUrl);
  if (todayMissingLinks.length > 0) {
    alerts.push({
      id: genAlertId(), priority: "warning",
      title: "TikTok Links Missing — Today's Posts",
      message: `${todayMissingLinks.length} post(s) scheduled today without TikTok links: ${todayMissingLinks.map((s) => s.campaignId).join(", ")}.`,
      timestamp: now,
    });
  }

  // Warning: overdue posts missing TikTok links
  if (missingLinkScheds.length > 0) {
    alerts.push({
      id: genAlertId(), priority: "warning",
      title: "Overdue Posts Missing TikTok Links",
      message: `${missingLinkScheds.length} overdue post(s) still need TikTok URLs submitted.`,
      timestamp: now,
    });
  }

  // Warning: amount mismatches
  if (amountMismatches.length > 0) {
    alerts.push({
      id: genAlertId(), priority: "warning",
      title: "Payment Amount Mismatches",
      message: `${amountMismatches.length} payment(s) have amount discrepancies. ${mismatchDetails.slice(0, 3).join("; ")}`,
      timestamp: now,
    });
  }

  // Normal: campaigns with pending admin review
  const pendingAdminReview = allCampaigns.filter((c) => c.status === "Pending Admin Review");
  if (pendingAdminReview.length > 0) {
    alerts.push({
      id: genAlertId(), priority: "normal",
      title: "Pending Admin Reviews",
      message: `${pendingAdminReview.length} campaign(s) waiting for admin review.`,
      timestamp: now,
    });
  }

  // Normal: pending payment verification
  if (pendingPayments.length > 0) {
    alerts.push({
      id: genAlertId(), priority: "normal",
      title: "Payments Pending Verification",
      message: `${pendingPayments.length} payment(s) totaling ${formatCurrency(totalPendingAmount)} awaiting verification.`,
      timestamp: now,
    });
  }

  // Normal: unassigned campaigns
  if (unassigned.length > 0) {
    alerts.push({
      id: genAlertId(), priority: "normal",
      title: "Unassigned Campaigns",
      message: `${unassigned.length} campaign(s) still need an editor assigned.`,
      timestamp: now,
    });
  }

  // Info: upcoming posts this week
  const thisWeek = allSchedules.filter((s) => {
    if (s.postingStatus === "Posted" || s.postingStatus === "Reposted") return false;
    const scheduled = new Date(`${s.scheduledDate}T${s.scheduledTime}`);
    return scheduled > new Date() && scheduled < new Date(Date.now() + 7 * 86400000);
  });
  if (thisWeek.length > 0) {
    alerts.push({
      id: genAlertId(), priority: "info",
      title: "Upcoming Posts This Week",
      message: `${thisWeek.length} post(s) scheduled in the next 7 days.`,
      timestamp: now,
    });
  }

  // Info: completed campaigns
  const completedCount = allCampaigns.filter((c) => c.status === "Completed").length;
  if (completedCount > 0) {
    alerts.push({
      id: genAlertId(), priority: "info",
      title: "Completed Campaigns",
      message: `${completedCount} campaign(s) completed. Total revenue tracking active.`,
      timestamp: now,
    });
  }

  return {
    generatedAt: now,
    campaigns: {
      total: allCampaigns.length,
      byStatus,
      pendingPayment: pendingPayments.map(toBrief),
      editing: allCampaigns.filter((c) => c.status === "Editing").map(toBrief),
      pendingAdminReview: pendingAdminReview.map(toBrief),
      pendingArtistApproval: allCampaigns.filter((c) => c.status === "Pending Artist Review").map(toBrief),
      artistRevisionRequested: allCampaigns.filter((c) => c.status === "Artist Revision Requested").map(toBrief),
      readyToSchedule: allCampaigns.filter((c) => c.status === "Ready To Schedule" || c.status === "Template Created").map(toBrief),
      overdueForReview,
      unpaid: pendingPayments.map(toBrief),
      unassigned,
    },
    schedules: {
      total: allSchedules.length,
      today: todayBrief,
      overdue: schedBrief(overdueScheds),
      missingTikTokLinks: schedBrief(missingLinkScheds),
      pendingVerification: schedBrief(pendingVerifScheds),
      posted: postedScheds.length,
      thisWeek: thisWeek.length,
    },
    editors: {
      total: EDITORS.length,
      workload: editorWorkload,
      pendingSubmissions: pendingReviewCount,
    },
    payments: {
      pendingVerification: pendingPayments.length,
      amountMismatches: amountMismatches.length,
      rejected: allCampaigns.filter((c) => c.status === "Rejected").length,
      totalPendingAmount,
      amountMismatchDetails: mismatchDetails,
    },
    reviews: {
      total: allReviews.length,
      recentActions: allReviews.slice(0, 5).map((r) =>
        `${r.campaignId}: ${r.action} on ${new Date(r.timestamp).toLocaleDateString()}`
      ),
      campaignsWithRevisions: campaignIdsWithRevisions.size,
      pendingRevisionCount: revisionCount,
    },
    notifications: {
      unread: (() => { try { return JSON.parse(localStorage.getItem("sharpconnect_notifications") || "[]").filter((n: any) => !n.read).length; } catch { return 0; } })(),
      urgent: (() => { try { return JSON.parse(localStorage.getItem("sharpconnect_notifications") || "[]").filter((n: any) => !n.read && n.priority === "urgent").length; } catch { return 0; } })(),
      summary: notifSummary,
    },
    alerts,
  };
}

/* ─── ALERT COUNT (for badge) ─────────────────────────────── */

export function getCriticalAlertCount(): number {
  try {
    return buildOperationalContext().alerts.filter((a) => a.priority === "critical").length;
  } catch {
    return 0;
  }
}

export function getTotalAlertCount(): number {
  try {
    return buildOperationalContext().alerts.length;
  } catch {
    return 0;
  }
}

/* ─── FORMAT CONTEXT FOR AI PROMPT ────────────────────────── */

export function formatContextForAI(ctx: OperationalContext): string {
  const lines: string[] = [];

  lines.push(`## SharpConnect Operations Dashboard (${new Date(ctx.generatedAt).toLocaleString()})`);
  lines.push("");

  // Campaign summary
  lines.push(`### Campaign Overview`);
  lines.push(`Total: ${ctx.campaigns.total} campaigns`);
  const statusSummary = Object.entries(ctx.campaigns.byStatus)
    .map(([s, n]) => `${s}: ${n}`)
    .join(", ");
  lines.push(`By status: ${statusSummary}`);
  lines.push("");

  // Pending payments
  if (ctx.payments.pendingVerification > 0) {
    lines.push(`### Payments`);
    lines.push(`Pending verification: ${ctx.payments.pendingVerification} (${formatCurrency(ctx.payments.totalPendingAmount)} total)`);
    if (ctx.payments.amountMismatches > 0) {
      lines.push(`⚠ Amount mismatches detected: ${ctx.payments.amountMismatches}`);
      ctx.payments.amountMismatchDetails.slice(0, 5).forEach((d) => lines.push(`  - ${d}`));
    }
    if (ctx.payments.rejected > 0) lines.push(`Rejected: ${ctx.payments.rejected}`);
    lines.push("");
  }

  // Editor pipeline
  lines.push(`### Editor Pipeline`);
  lines.push(`Pending admin review: ${ctx.editors.pendingSubmissions}`);
  lines.push(`Campaigns needing revision: ${ctx.reviews.pendingRevisionCount}`);
  lines.push(`Editor workload:`);
  ctx.editors.workload.forEach((e) => {
    lines.push(`  - ${e.name} (${e.role}): ${e.activeCampaigns} active`);
  });
  if (ctx.campaigns.overdueForReview.length > 0) {
    lines.push(`⚠ Overdue for review (48h+): ${ctx.campaigns.overdueForReview.length}`);
    ctx.campaigns.overdueForReview.slice(0, 5).forEach((c) =>
      lines.push(`  - ${c.campaignId}: ${c.artistName} — ${c.songTitle}`)
    );
  }
  lines.push("");

  // Artist pipeline
  if (ctx.campaigns.pendingArtistApproval.length > 0) {
    lines.push(`### Artist Approvals`);
    lines.push(`Waiting for artist: ${ctx.campaigns.pendingArtistApproval.length}`);
    ctx.campaigns.pendingArtistApproval.slice(0, 5).forEach((c) => {
      const days = Math.floor((Date.now() - new Date(c.submittedAt).getTime()) / 86400000);
      lines.push(`  - ${c.campaignId}: ${c.artistName} (${days}d waiting)`);
    });
  }
  if (ctx.campaigns.artistRevisionRequested.length > 0) {
    lines.push(`Artist revisions requested: ${ctx.campaigns.artistRevisionRequested.length}`);
    ctx.campaigns.artistRevisionRequested.slice(0, 5).forEach((c) =>
      lines.push(`  - ${c.campaignId}: ${c.artistName}`)
    );
  }
  lines.push("");

  // Scheduling
  lines.push(`### Posting Schedule`);
  lines.push(`Today's posts: ${ctx.schedules.today.length}`);
  lines.push(`Overdue posts: ${ctx.schedules.overdue.length}`);
  lines.push(`Posted: ${ctx.schedules.posted}`);
  lines.push(`This week: ${ctx.schedules.thisWeek}`);

  if (ctx.schedules.missingTikTokLinks.length > 0) {
    lines.push(`⚠ Missing TikTok links: ${ctx.schedules.missingTikTokLinks.length}`);
    ctx.schedules.missingTikTokLinks.slice(0, 5).forEach((s) =>
      lines.push(`  - ${s.campaignId} on ${s.platformName}`)
    );
  }
  if (ctx.schedules.pendingVerification.length > 0) {
    lines.push(`Pending verification: ${ctx.schedules.pendingVerification.length}`);
  }
  if (ctx.schedules.today.length > 0) {
    lines.push(`Today's schedule:`);
    ctx.schedules.today.forEach((s) =>
      lines.push(`  - ${s.campaignId} on ${s.platformName} at ${s.scheduledTime} (${s.status})`)
    );
  }
  lines.push("");

  // Unassigned
  if (ctx.campaigns.unassigned.length > 0) {
    lines.push(`### Unassigned Campaigns`);
    lines.push(`${ctx.campaigns.unassigned.length} campaign(s) without an editor:`);
    ctx.campaigns.unassigned.slice(0, 5).forEach((c) =>
      lines.push(`  - ${c.campaignId}: ${c.artistName} — ${c.songTitle}`)
    );
    lines.push("");
  }

  // Alerts summary
  if (ctx.alerts.length > 0) {
    lines.push(`### Active Alerts (${ctx.alerts.length})`);
    const byPriority = (p: string) => ctx.alerts.filter((a) => a.priority === p);
    const criticals = byPriority("critical");
    const warnings = byPriority("warning");
    const normals = byPriority("normal");
    if (criticals.length > 0) lines.push(`🔴 Critical: ${criticals.length}`);
    if (warnings.length > 0) lines.push(`🟡 Warnings: ${warnings.length}`);
    if (normals.length > 0) lines.push(`🔵 Normal: ${normals.length}`);
    lines.push("");
  }

  // Recent reviews
  if (ctx.reviews.recentActions.length > 0) {
    lines.push(`### Recent Activity`);
    ctx.reviews.recentActions.forEach((a) => lines.push(`  - ${a}`));
    lines.push("");
  }

  return lines.join("\n");
}

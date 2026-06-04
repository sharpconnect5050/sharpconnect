"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCampaign, updateCampaign, type Campaign } from "@/lib/adminData";
import { getAllPendingSubmissions, getAllReviewedSubmissions, saveEditorSubmission, getEditorById, type EditorSubmission } from "@/lib/editors";
import { getAllReviewHistory, getCampaignReviewHistory, logReviewAction, type ReviewAction } from "@/lib/reviews";
import { addAlert } from "@/components/AdminNotifications";
import { logEvent } from "@/lib/events";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  needs_revision: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending Review",
  approved: "Approved",
  needs_revision: "Needs Revision",
};

export default function AdminReviewsPage() {
  const [pending, setPending] = useState<(EditorSubmission & { campaign?: Campaign | null })[]>([]);
  const [reviewed, setReviewed] = useState<(EditorSubmission & { campaign?: Campaign | null })[]>([]);
  const [selected, setSelected] = useState<EditorSubmission & { campaign?: Campaign | null } | null>(null);
  const [reviewHistory, setReviewHistory] = useState<ReviewAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewNotes, setReviewNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [tab, setTab] = useState<"pending" | "reviewed">("pending");

  const load = useCallback(async () => {
    const pendingSubs = getAllPendingSubmissions();
    const reviewedSubs = getAllReviewedSubmissions();

    const withCampaigns = await Promise.all(
      pendingSubs.map(async (s) => ({ ...s, campaign: await getCampaign(s.campaignId) }))
    );
    const withReviewed = await Promise.all(
      reviewedSubs.map(async (s) => ({ ...s, campaign: await getCampaign(s.campaignId) }))
    );

    setPending(withCampaigns.filter((s) => s.campaign));
    setReviewed(withReviewed.filter((s) => s.campaign));
    setLoading(false);
  }, []);

  useEffect(() => {
    let m = true;
    load().then(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [load]);

  useEffect(() => {
    if (selected) {
      setReviewHistory(getCampaignReviewHistory(selected.campaignId));
    }
  }, [selected]);

  const handleApprove = async (sub: EditorSubmission & { campaign?: Campaign | null }) => {
    if (!sub.campaign) return;
    setActionLoading(true);
    try {
      await updateCampaign(sub.campaignId, { status: "Ready To Schedule" });
      const updated = { ...sub, status: "approved" as const, reviewedAt: new Date().toISOString() };
      saveEditorSubmission(updated);
      logReviewAction(sub.campaignId, sub.editorId, "approved");
      addAlert("campaign_started", `Edit approved for ${sub.campaignId}`, sub.campaignId);
      await logEvent(sub.campaignId, "admin_approved", { editorId: sub.editorId });
      setSelected(null);
      load();
    } catch (e) { console.error("[handleApprove] failed:", e); }
    setActionLoading(false);
  };

  const handleRequestRevision = async (sub: EditorSubmission & { campaign?: Campaign | null }) => {
    if (!sub.campaign) return;
    const reason = reviewNotes.trim() || "Please revise and resubmit.";
    setActionLoading(true);
    try {
      await updateCampaign(sub.campaignId, { status: "Needs Revision" });
      const updated = { ...sub, status: "needs_revision" as const, adminNotes: reason, reviewedAt: new Date().toISOString() };
      saveEditorSubmission(updated);
      logReviewAction(sub.campaignId, sub.editorId, "revision_requested", reason);
      addAlert("revision_requested", `Revision requested for ${sub.campaignId}`, sub.campaignId);
      await logEvent(sub.campaignId, "revision_requested", { editorId: sub.editorId, notes: reason });
      setSelected(null);
      setReviewNotes("");
      load();
    } catch (e) { console.error("[handleRequestRevision] failed:", e); }
    setActionLoading(false);
  };

  const allHistory = getAllReviewHistory();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-white">Review Queue</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {pending.length} submission{pending.length !== 1 ? "s" : ""} waiting for review
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-white/[0.04] rounded-xl p-1">
          <button
            onClick={() => setTab("pending")}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all touch-target ${
              tab === "pending" ? "bg-red-500/20 text-red-400" : "text-zinc-500 hover:text-white"
            }`}
          >
            Pending {pending.length > 0 && `(${pending.length})`}
          </button>
          <button
            onClick={() => setTab("reviewed")}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all touch-target ${
              tab === "reviewed" ? "bg-red-500/20 text-red-400" : "text-zinc-500 hover:text-white"
            }`}
          >
            Reviewed ({reviewed.length})
          </button>
        </div>
      </div>

      {tab === "pending" && (
        <>
          {pending.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-xl p-12 text-center"
            >
              <span className="text-4xl block mb-3">✅</span>
              <p className="text-sm text-zinc-400">All caught up!</p>
              <p className="text-xs text-zinc-600 mt-1">No pending editor submissions.</p>
            </motion.div>
          ) : (
            <div className="grid gap-3">
              {pending.map((sub, idx) => {
                const editor = getEditorById(sub.editorId);
                const editedVideo = sub.files.find((f) => f.fileType === "edited_video");
                const isSelected = selected?.taskId === sub.taskId;
                return (
                  <motion.div
                    key={sub.taskId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <div
                      onClick={() => setSelected(isSelected ? null : sub)}
                      className={`rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? "border-red-500/40 bg-red-500/[0.04]"
                          : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10"
                      } backdrop-blur-xl p-4`}
                    >
                      <div className="flex items-start gap-3">
                        {editedVideo ? (
                          <div className="w-16 h-16 rounded-lg overflow-hidden bg-black/60 shrink-0">
                            <video className="w-full h-full object-cover" src={editedVideo.fileUrl} muted />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
                            <svg className="w-6 h-6 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-white truncate">
                                {sub.campaign?.campaignId || sub.campaignId}
                              </p>
                              <p className="text-xs text-zinc-400 truncate mt-0.5">
                                {sub.campaign?.artistName || "Unknown Artist"}
                              </p>
                            </div>
                            <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[sub.status]}`}>
                              {STATUS_LABELS[sub.status]}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-500">
                            {editor && (
                              <div className="flex items-center gap-1">
                                <div className={`w-4 h-4 rounded bg-gradient-to-br ${editor.color} flex items-center justify-center text-[6px] font-bold text-white`}>
                                  {editor.initials}
                                </div>
                                {editor.name}
                              </div>
                            )}
                            <span>{new Date(sub.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                        </div>
                        <svg className={`w-4 h-4 mt-1 text-zinc-600 transition-transform ${isSelected ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>

                      <AnimatePresence>
                        {isSelected && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="pt-4 mt-4 border-t border-white/5 space-y-4">
                              {sub.files.map((file) => (
                                <div key={file.id}>
                                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">
                                    {file.fileType === "edited_video" ? "Edited Video" : file.fileType === "completed_template" ? "Template" : "Export File"}
                                  </p>
                                  {file.mimeType.startsWith("video/") ? (
                                    <div className="rounded-xl overflow-hidden bg-black/60">
                                      <video controls className="w-full max-h-64 object-contain" src={file.fileUrl} />
                                    </div>
                                  ) : file.mimeType.startsWith("audio/") ? (
                                    <audio controls className="w-full" src={file.fileUrl} />
                                  ) : (
                                    <a href={file.fileUrl} target="_blank" rel="noopener noreferrer"
                                      className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.04] text-xs text-zinc-300 hover:text-white"
                                    >
                                      <svg className="w-3.5 h-3.5 text-purple-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                      </svg>
                                      <span className="truncate">{file.fileName}</span>
                                    </a>
                                  )}
                                </div>
                              ))}

                              {sub.notes && (
                                <div>
                                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Editor Notes</p>
                                  <p className="text-xs text-zinc-400 bg-white/[0.04] rounded-xl p-3">{sub.notes}</p>
                                </div>
                              )}

                              <div>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Admin Notes (for revision)</p>
                                <textarea
                                  value={reviewNotes}
                                  onChange={(e) => setReviewNotes(e.target.value)}
                                  placeholder="Type revision notes here..."
                                  rows={2}
                                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-red-500/30 resize-none"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  onClick={() => handleApprove(sub)}
                                  disabled={actionLoading}
                                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 disabled:opacity-50 text-white text-xs font-semibold active:scale-[0.98] transition-all"
                                >
                                  {actionLoading ? (
                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                  Approve Final Edit
                                </button>
                                <button
                                  onClick={() => handleRequestRevision(sub)}
                                  disabled={actionLoading}
                                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 disabled:opacity-50 text-white text-xs font-semibold active:scale-[0.98] transition-all"
                                >
                                  {actionLoading ? (
                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                  )}
                                  Request Revision
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === "reviewed" && (
        <div className="space-y-2">
          {reviewed.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-12 text-center">
              <span className="text-4xl block mb-3">📋</span>
              <p className="text-sm text-zinc-400">No reviewed submissions yet.</p>
            </div>
          ) : (
            reviewed.map((sub, idx) => {
              const editor = getEditorById(sub.editorId);
              const history = getCampaignReviewHistory(sub.campaignId);
              const lastAction = history[0];
              return (
                <motion.div key={sub.taskId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
                  className="rounded-xl border border-white/5 bg-white/[0.02] p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white">{sub.campaignId}</p>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[sub.status]}`}>
                          {STATUS_LABELS[sub.status]}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-zinc-500">
                        {editor && <span>{editor.name}</span>}
                        <span>{new Date(sub.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                        {lastAction && (
                          <span className="text-zinc-600">
                            {lastAction.action === "approved" ? "Approved" : "Revision requested"} &middot; {new Date(lastAction.timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </span>
                        )}
                      </div>
                      {sub.adminNotes && (
                        <p className="text-xs text-zinc-500 mt-2 bg-white/[0.03] rounded-lg p-2">{sub.adminNotes}</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* Review History */}
      {allHistory.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-white mb-3">Review History</h2>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] divide-y divide-white/5">
            {allHistory.slice(0, 20).map((action) => {
              const editor = getEditorById(action.editorId);
              return (
                <div key={action.id} className="flex items-center gap-3 px-4 py-3 text-xs">
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${
                    action.action === "approved" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                  }`}>
                    {action.action === "approved" ? "✓" : "↻"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-300">
                      <span className="font-medium text-white">{action.campaignId}</span>
                      {" "}{action.action === "approved" ? "approved" : "revision requested"}
                      {editor ? ` by ${editor.name}` : ""}
                    </p>
                    {action.adminNotes && (
                      <p className="text-zinc-600 mt-0.5 truncate">{action.adminNotes}</p>
                    )}
                  </div>
                  <span className="text-zinc-600 shrink-0">
                    {new Date(action.timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

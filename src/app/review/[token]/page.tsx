"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getCampaign, updateCampaign, formatCurrency, type Campaign } from "@/lib/adminData";
import { getCampaignSubmission, getEditorById, type EditorSubmission } from "@/lib/editors";
import {
  getArtistReviews, addArtistReview, getArtistReviewHistory,
  getCampaignByToken, touchToken, getReviewComments, addReviewComment,
  type ArtistReviewEntry, type ArtistVersionRecord, type ReviewComment,
} from "@/lib/artistReview";
import { addNotification } from "@/lib/notifications";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ReviewPage() {
  const { token } = useParams<{ token: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [submission, setSubmission] = useState<EditorSubmission | null>(null);
  const [reviews, setReviews] = useState<ArtistReviewEntry[]>([]);
  const [versions, setVersions] = useState<ArtistVersionRecord[]>([]);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [comment, setComment] = useState("");
  const [commentTimestamp, setCommentTimestamp] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) return;
    let mounted = true;
    (async () => {
      let rt = getCampaignByToken(token);
      if (!rt) {
        try {
          const res = await fetch(`/api/review/${token}`);
          if (res.ok) {
            const data = await res.json();
            import("@/lib/artistReview").then((m) => {
              if (!mounted) return;
              const existing = m.getCampaignByToken(token);
              if (!existing) {
                const tokens = JSON.parse(localStorage.getItem("sharpconnect_review_tokens") || "[]");
                tokens.push({ token, campaignId: data.campaignId, status: "active", createdAt: new Date().toISOString(), lastAccessedAt: new Date().toISOString() });
                localStorage.setItem("sharpconnect_review_tokens", JSON.stringify(tokens));
              }
            });
            rt = { token, campaignId: data.campaignId, status: "active" as const, createdAt: "", lastAccessedAt: "" };
          }
        } catch (e) { console.error("[ReviewPage] fetch token failed:", e); }
      }
      if (!mounted) return;
      if (!rt) { setNotFound(true); setLoading(false); return; }
      touchToken(token);
      try {
        const c = await getCampaign(rt.campaignId);
        if (!mounted) return;
        if (!c) { setNotFound(true); setLoading(false); return; }
        setCampaign(c);
      } catch (e) { console.error("[ReviewPage] getCampaign failed:", e); }
      try {
        const sub = getCampaignSubmission(rt.campaignId);
        if (mounted) setSubmission(sub || null);
      } catch (e) { console.error("[ReviewPage] getSubmission failed:", e); }
      try {
        setReviews(getArtistReviews(rt.campaignId));
        setVersions(getArtistReviewHistory(rt.campaignId));
        setComments(getReviewComments(rt.campaignId));
      } catch (e) { console.error("[ReviewPage] getReviews failed:", e); }
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, [token]);

  const handleApprove = async () => {
    if (!campaign) return;
    setActionLoading("approve");
    try {
      await addArtistReview({ campaignId: campaign.campaignId, version: versions.length + 1, action: "approved", comment });
      if (commentTimestamp !== null || comment.trim()) {
        addReviewComment({
          token, campaignId: campaign.campaignId, text: comment,
          timestampSeconds: commentTimestamp, version: versions.length + 1, author: "artist",
        });
      }
      await updateCampaign(campaign.campaignId, { status: "Ready To Schedule" });
      await addNotification("artist_approved", "Artist Approved ✅",
        `${campaign.artistName} approved the final version for ${campaign.campaignId}.`, campaign.campaignId, "high");

      if (submission) {
        const { saveEditorSubmission } = await import("@/lib/editors");
        const updated = { ...submission, status: "approved" as const, reviewedAt: new Date().toISOString() };
        saveEditorSubmission(updated);
      }
      setCampaign(await getCampaign(campaign.campaignId) || campaign);
      setReviews(getArtistReviews(campaign.campaignId));
      setComments(getReviewComments(campaign.campaignId));
    } catch (e) { console.error("[ReviewPage] approve failed:", e); }
    setActionLoading(null);
    setComment("");
    setCommentTimestamp(null);
  };

  const handleRequestChanges = async () => {
    if (!campaign || !comment.trim()) return;
    setActionLoading("revision");
    try {
      await addArtistReview({
        campaignId: campaign.campaignId, version: versions.length + 1,
        action: "revision_requested", comment,
      });
      addReviewComment({
        token, campaignId: campaign.campaignId, text: comment,
        timestampSeconds: commentTimestamp, version: versions.length + 1, author: "artist",
      });
      await updateCampaign(campaign.campaignId, { status: "Artist Revision Requested" });
      await addNotification("artist_revision_requested", "Revision Requested 🔄",
        `${campaign.artistName} requested changes for ${campaign.campaignId}: "${comment}"`,
        campaign.campaignId, "high");

      if (submission) {
        const { saveEditorSubmission } = await import("@/lib/editors");
        const updated = { ...submission, status: "needs_revision" as const, adminNotes: comment, reviewedAt: new Date().toISOString() };
        saveEditorSubmission(updated);
      }
      setCampaign(await getCampaign(campaign.campaignId) || campaign);
      setReviews(getArtistReviews(campaign.campaignId));
      setComments(getReviewComments(campaign.campaignId));
    } catch (e) { console.error("[ReviewPage] revision failed:", e); }
    setActionLoading(null);
  };

  const addTimestamp = (seconds: number) => {
    setCommentTimestamp(seconds);
    setComment((prev) => prev + ` [${formatTime(seconds)}] `);
  };

  const isPendingReview = useMemo(() =>
    campaign && (campaign.status === "Pending Artist Review" || campaign.status === "Artist Revision Requested" || campaign.status === "Approved"),
  [campaign]);

  const hasApproved = useMemo(() => reviews.some((r) => r.action === "approved"), [reviews]);
  const currentVersion = versions.length;
  const videoFile = submission?.files.find((f) => f.fileType === "edited_video");
  const editor = submission ? getEditorById(submission.editorId) : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-6 h-6 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !campaign) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black px-4">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white">Review Link Not Found</h2>
        <p className="text-sm text-zinc-500 mt-2 text-center max-w-sm">This review link is invalid or has expired. Contact SharpConnect support if you need a new one.</p>
        <a href="/" className="mt-6 px-6 py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-700 text-white text-sm font-semibold hover:from-red-500 hover:to-red-600 transition-all shadow-lg shadow-red-500/10">
          Go to SharpConnect
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="sticky top-0 z-20 bg-black/95 backdrop-blur-2xl border-b border-white/[0.04] px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
              S
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold truncate">Review Campaign</h1>
              <p className="text-[10px] text-zinc-500 truncate">{campaign.artistName} — {campaign.songTitle}</p>
            </div>
          </div>
          {currentVersion > 0 && (
            <span className="text-[10px] text-zinc-600 bg-white/[0.04] px-2.5 py-1 rounded-full shrink-0 ml-2 font-mono">
              v{currentVersion}
            </span>
          )}
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 sticky-footer-offset">
        <AnimatePresence>
          {hasApproved && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="pt-4 pb-2"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-400">You Approved This Version</p>
                  <p className="text-xs text-zinc-500">Your campaign will move to scheduling soon.</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="py-4 border-b border-white/[0.04]">
          <div className="flex items-center gap-4 text-xs">
            <div>
              <p className="text-[10px] text-zinc-600 mb-0.5">Package</p>
              <p className="text-white font-medium">{campaign.packageName}</p>
            </div>
            <div className="w-px h-6 bg-white/[0.04]" />
            <div>
              <p className="text-[10px] text-zinc-600 mb-0.5">Total</p>
              <p className="text-white font-medium">{formatCurrency(campaign.total)}</p>
            </div>
            <div className="w-px h-6 bg-white/[0.04]" />
            <div>
              <p className="text-[10px] text-zinc-600 mb-0.5">Sound</p>
              <p className="text-white font-medium">
                {campaign.soundOption === "slow-reverb" ? "Slow + Reverb" : campaign.soundOption === "fast" ? "Fast" : "Original"}
              </p>
            </div>
          </div>
          {campaign.creativeDirection && (
            <p className="text-xs text-zinc-500 mt-3 leading-relaxed">
              <span className="text-zinc-600">Brief: </span>
              {campaign.creativeDirection}
            </p>
          )}
        </div>

        <div className="py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Final Edit</h2>
            {editor && <span className="text-[10px] text-zinc-600">by {editor.name}</span>}
          </div>

          {videoFile ? (
            <div className="rounded-xl overflow-hidden bg-black/60 border border-white/[0.04]">
              <video controls className="w-full max-h-[70vh] object-contain" src={videoFile.fileUrl} playsInline />
            </div>
          ) : submission ? (
            <div className="py-10 text-center">
              <p className="text-sm text-amber-400 font-medium">No video files available</p>
              <p className="text-xs text-zinc-600 mt-1">The editor submitted work but no video was found.</p>
            </div>
          ) : (
            <div className="py-10 text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-white/[0.04] flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm text-zinc-400 font-medium">No edit available yet</p>
              <p className="text-xs text-zinc-600 mt-1">Check back later.</p>
            </div>
          )}
        </div>

        {submission &&
          (() => {
            const templateFile = submission.files.find((f) => f.fileType === "completed_template");
            const exportFile = submission.files.find((f) => f.fileType === "export_file");
            if (!templateFile && !exportFile) return null;
            return (
              <div className="flex gap-2 pb-4 border-b border-white/[0.04]">
                {templateFile && (
                  <a href={templateFile.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    <svg className="w-3 h-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Template
                  </a>
                )}
                {exportFile && (
                  <a href={exportFile.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    <svg className="w-3 h-3 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export
                  </a>
                )}
              </div>
            );
          })()}

        {versions.length > 0 && (
          <div className="py-4 border-b border-white/[0.04]">
            <h3 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-3">Version History</h3>
            <div className="space-y-3">
              {[...versions].reverse().map((v) => (
                <div key={v.version} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/[0.04] flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[9px] text-zinc-600">{v.version}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">Version {v.version}</span>
                      {v.artistReview && (
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                          v.artistReview.action === "approved"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-amber-500/10 text-amber-400"
                        }`}>
                          {v.artistReview.action === "approved" ? "Approved" : "Changes"}
                        </span>
                      )}
                      <span className="text-[9px] text-zinc-700 ml-auto">{new Date(v.submittedAt).toLocaleDateString()}</span>
                    </div>
                    {v.editorNotes && <p className="text-xs text-zinc-500 mt-1">{v.editorNotes}</p>}
                    {v.artistReview?.comment && (
                      <p className="text-xs text-zinc-400 bg-white/[0.02] rounded-lg p-2 mt-1">{v.artistReview.comment}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {comments.length > 0 && (
          <div className="py-4 border-b border-white/[0.04]">
            <h3 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-3">Comments</h3>
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="flex items-start gap-3">
                  <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${c.author === "artist" ? "bg-red-500" : "bg-blue-500"}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-zinc-400 capitalize">{c.author}</span>
                      {c.timestampSeconds !== null && (
                        <span className="text-[9px] font-mono text-blue-400 bg-blue-500/10 px-1 py-0.5 rounded">
                          {formatTime(c.timestampSeconds)}
                        </span>
                      )}
                      <span className="text-[9px] text-zinc-700">{new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-zinc-300 mt-0.5">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {reviews.length > 0 && !hasApproved && (
          <div className="py-4 border-b border-white/[0.04]">
            <h3 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-3">Review History</h3>
            <div className="space-y-3">
              {reviews.map((r) => (
                <div key={r.id} className="flex items-start gap-3">
                  <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${
                    r.action === "approved" ? "bg-emerald-500" : r.action === "revision_requested" ? "bg-amber-500" : "bg-zinc-500"
                  }`} />
                  <div className="min-w-0">
                    <p className="text-sm text-white font-medium capitalize">{r.action.replace("_", " ")}</p>
                    {r.comment && <p className="text-xs text-zinc-400 mt-0.5">{r.comment}</p>}
                    <p className="text-[9px] text-zinc-600 mt-1">{new Date(r.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isPendingReview && !hasApproved && submission && (
          <div className="py-6 text-center">
            <p className="text-sm text-zinc-500">This campaign is not ready for review yet.</p>
            <p className="text-xs text-zinc-700 mt-1">You&apos;ll receive a notification when your edit is ready.</p>
          </div>
        )}
      </main>

      {isPendingReview && submission && !hasApproved && (
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-black/95 backdrop-blur-2xl border-t border-white/[0.04] p-4 safe-area-bottom">
          <div className="max-w-3xl mx-auto">
            {videoFile && (
              <div className="flex gap-1.5 overflow-x-auto hide-scrollbar mb-3">
                {[0, 3, 7, 14, 21].map((s) => (
                  <button key={s} onClick={() => addTimestamp(s)}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.04] text-[9px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
                  >{formatTime(s)}</button>
                ))}
              </div>
            )}

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={actionLoading === "revision" ? "Describe what changes you'd like..." : "Optional feedback..."}
              rows={1}
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-700 outline-none transition-all duration-200 focus:border-red-500/50 resize-none mb-3"
            />

            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleRequestChanges}
                disabled={actionLoading !== null || !comment.trim()}
                className="py-4 rounded-xl border border-amber-500/25 text-amber-400 text-sm font-semibold disabled:opacity-40 active:scale-[0.98] transition-transform touch-target"
              >
                {actionLoading === "revision" ? (
                  <div className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin block mx-auto" />
                ) : (
                  "Request Changes"
                )}
              </button>
              <button onClick={handleApprove}
                disabled={actionLoading !== null}
                className="py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 text-white text-sm font-semibold disabled:opacity-40 active:scale-[0.98] transition-transform touch-target shadow-lg shadow-emerald-500/10"
              >
                {actionLoading === "approve" ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin block mx-auto" />
                ) : (
                  "Approve & Finish"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

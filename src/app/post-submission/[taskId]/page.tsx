"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { getCampaign, updateCampaign, type Campaign } from "@/lib/adminData";
import { getPostSubmissionTask, submitPostLink, validateTikTokUrl } from "@/lib/scheduling";

export default function PostSubmissionPage() {
  const params = useParams();
  const taskId = params?.taskId as string;

  const [task, setTask] = useState<ReturnType<typeof getPostSubmissionTask>>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [captionNotes, setCaptionNotes] = useState("");
  const [submitterName, setSubmitterName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!taskId) return;
    let mounted = true;
    const t = getPostSubmissionTask(taskId);
    if (!t) { setInvalid(true); setLoading(false); return; }
    setTask(t);
    setSubmitterName(t.assignedPoster);

    getCampaign(t.campaignId).then((c) => {
      if (!mounted) return;
      if (!c) { setInvalid(true); setLoading(false); return; }
      setCampaign(c);
      setLoading(false);
    }).catch((e) => { console.error("[PostSubmissionPage] getCampaign failed:", e); if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [taskId]);

  const handleSubmit = async () => {
    if (!task || !campaign) return;
    setError("");

    const url = tiktokUrl.trim();
    if (!url) { setError("Please paste the TikTok post URL."); return; }
    if (!validateTikTokUrl(url)) { setError("Invalid TikTok URL. Must be a tiktok.com or vm.tiktok.com link."); return; }

    setSubmitting(true);
    try {
      submitPostLink(task.scheduleId, url, submitterName || task.assignedPoster, captionNotes.trim() || undefined);
      await updateCampaign(campaign.campaignId, { status: "Posted" });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Submission failed");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="max-w-sm w-full rounded-2xl border border-red-500/20 bg-red-500/5 backdrop-blur-xl p-8 text-center"
        >
          <span className="text-4xl block mb-4">🔒</span>
          <h1 className="text-base font-bold text-red-400 mb-2">Invalid Link</h1>
          <p className="text-xs text-zinc-500">This submission link is invalid or expired.</p>
        </motion.div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="max-w-sm w-full rounded-2xl border border-green-500/20 bg-green-500/5 backdrop-blur-xl p-8 text-center"
        >
          <span className="text-4xl block mb-4">✅</span>
          <h1 className="text-base font-bold text-green-400 mb-2">Post Confirmed!</h1>
          <p className="text-xs text-zinc-400 mb-4">Your TikTok post has been submitted for verification.</p>
          <a href={tiktokUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            View on TikTok
          </a>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-lg mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-xs font-bold">S</div>
            <div>
              <p className="text-sm font-bold">Submit TikTok Post</p>
              <p className="text-[10px] text-zinc-500">Confirm your scheduled post is live</p>
            </div>
          </div>

          {/* Campaign card */}
          <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <code className="text-[11px] font-mono text-red-400 bg-red-500/10 px-2 py-1 rounded-lg">{campaign?.campaignId}</code>
              {task && (
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                  task.status === "submitted" || task.status === "verified" ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                }`}>
                  {task.status === "pending" ? "Awaiting Post" : task.status === "submitted" ? "Submitted" : "Verified"}
                </span>
              )}
            </div>

            {campaign && (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 text-xs">Artist:</span>
                  <span className="text-white text-xs font-medium">{campaign.artistName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 text-xs">Song:</span>
                  <span className="text-white text-xs font-medium">{campaign.songTitle}</span>
                </div>
                {task && (
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500 text-xs">TikTok Page:</span>
                    <span className="text-white text-xs font-medium">{task.platformName}</span>
                  </div>
                )}
                {task && (
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500 text-xs">Assigned To:</span>
                    <span className="text-white text-xs font-medium">{task.assignedPoster}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Schedule info */}
          {task && (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Scheduled For</p>
              <p className="text-xs text-white font-medium">
                {new Date(task.createdAt).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          )}

          {/* Submission form */}
          <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 space-y-3">
            <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Confirm Post is Live</h3>

            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 block">TikTok Post URL *</label>
              <input
                value={tiktokUrl}
                onChange={(e) => setTiktokUrl(e.target.value)}
                placeholder="https://vm.tiktok.com/..."
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-red-500/30"
                autoFocus
              />
              <p className="text-[10px] text-zinc-600 mt-1">Paste the full TikTok post URL (tiktok.com or vm.tiktok.com)</p>
            </div>

            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 block">Your Name</label>
              <input
                value={submitterName}
                onChange={(e) => setSubmitterName(e.target.value)}
                placeholder="Your name"
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-red-500/30"
              />
            </div>

            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 block">Caption Notes (optional)</label>
              <textarea
                value={captionNotes}
                onChange={(e) => setCaptionNotes(e.target.value)}
                placeholder="Any notes about the post..."
                rows={2}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-red-500/30 resize-none"
              />
            </div>

            {error && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-red-400 bg-red-500/10 rounded-xl p-2.5">{error}</motion.p>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:opacity-50 text-white text-sm font-semibold active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Confirm Post Published
                </>
              )}
            </button>
          </div>

          {/* Tip */}
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <p className="text-[10px] text-zinc-500">
              💡 Open TikTok, go to your post, tap <strong className="text-zinc-400">Share</strong> &rarr; <strong className="text-zinc-400">Copy Link</strong>, then paste it above.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

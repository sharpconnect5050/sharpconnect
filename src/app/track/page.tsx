"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCampaigns, updateCampaign, formatDate, formatCurrency, type CampaignStatus, type Campaign } from "@/lib/adminData";
import { getCampaignSchedules } from "@/lib/scheduling";
import { getCampaignSubmission, saveEditorSubmission, type EditorSubmission } from "@/lib/editors";
import { addArtistReview, getArtistReviews, getArtistReviewHistory, getReviewComments, addReviewComment, promoteEditorSubmissionToVersion } from "@/lib/artistReview";
import { addNotification } from "@/lib/notifications";
import { logReviewAction } from "@/lib/reviews";
import { logArtistReviewOpened, logArtistApproved, logArtistComment } from "@/lib/activity-log";
import ArtistNotificationToast from "@/components/ArtistNotifications";

const statusFlow: { status: CampaignStatus; label: string; icon: string; desc: string }[] = [
  { status: "Paid", label: "Payment Verified", icon: "✅", desc: "Your payment has been confirmed" },
  { status: "Assigned", label: "In Production", icon: "🎬", desc: "Our team is working on your edit" },
  { status: "Pending Artist Review", label: "Waiting For Your Approval", icon: "👀", desc: "Your edit is ready — please review and approve" },
  { status: "Artist Revision Requested", label: "Revision Requested", icon: "🔄", desc: "You requested changes — editor is updating" },
  { status: "Approved By Artist", label: "Approved By You", icon: "✅", desc: "You approved the final version" },
  { status: "Scheduled", label: "Scheduled", icon: "📅", desc: "Scheduled for posting on TikTok" },
  { status: "Posted", label: "Live on TikTok", icon: "🔥", desc: "Your campaign is live and running" },
  { status: "Completed", label: "Completed", icon: "🎉", desc: "Campaign finished successfully" },
];

const statusOrder: CampaignStatus[] = ["Paid", "Assigned", "Pending Artist Review", "Artist Revision Requested", "Approved By Artist", "Scheduled", "Posted", "Completed"];

const clientStatusMap: Partial<Record<CampaignStatus, CampaignStatus>> = {
  "Pending Verification": "Paid",
  Assigned: "Assigned",
  Editing: "Assigned",
  "Pending Admin Review": "Pending Artist Review",
  "Needs Revision": "Assigned",
  Approved: "Pending Artist Review",
  "Pending Artist Review": "Pending Artist Review",
  "Artist Revision Requested": "Artist Revision Requested",
  "Approved By Artist": "Approved By Artist",
  "Ready To Schedule": "Approved By Artist",
  "Template Created": "Approved By Artist",
};

const WA_PHONE = process.env.NEXT_PUBLIC_WHATSAPP_PHONE || "233556513157";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function TrackPage() {
  const [searchId, setSearchId] = useState("");
  const [lookupId, setLookupId] = useState("");
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [animating, setAnimating] = useState(false);

  const [submission, setSubmission] = useState<EditorSubmission | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [comment, setComment] = useState("");
  const [commentTimestamp, setCommentTimestamp] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("sharpconnect_submitted");
    if (raw) {
      const data = JSON.parse(raw);
      setSearchId(data.campaignId);
      setLookupId(data.campaignId);
    }
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = lookupId.trim();
    if (!id || id.length < 3 || id.length > 50 || /[<>]/.test(id)) {
      setNotFound(true);
      return;
    }
    setNotFound(false);
    setAnimating(true);
    setApproved(false);
    setSubmission(null);
    setReviews([]);
    setVersions([]);
    setComments([]);
    setComment("");
    setCommentTimestamp(null);
    try {
      const all = await getCampaigns();
      const found = all.find((c) => c.campaignId.toUpperCase() === lookupId.toUpperCase().trim());
      setTimeout(() => {
        if (found) {
          setCampaign(found);
          setNotFound(false);
          loadReviewData(found.campaignId);
        } else {
          setCampaign(null);
          setNotFound(true);
        }
        setAnimating(false);
      }, 400);
    } catch (e) { console.error("[TrackPage] search failed:", e); setAnimating(false); }
  };

  const loadReviewData = (campaignId: string) => {
    const sub = getCampaignSubmission(campaignId);
    setSubmission(sub || null);
    setReviews(getArtistReviews(campaignId));
    setVersions(getArtistReviewHistory(campaignId));
    setComments(getReviewComments(campaignId));
    if (sub) promoteEditorSubmissionToVersion(campaignId);
    logArtistReviewOpened(campaignId);
  };

  const clientStatus = campaign ? (clientStatusMap[campaign.status as CampaignStatus] || campaign.status as CampaignStatus) : null;
  const currentIndex = clientStatus ? statusOrder.indexOf(clientStatus) : -1;

  const isReviewable = useMemo(() =>
    campaign && (campaign.status === "Pending Artist Review" || campaign.status === "Artist Revision Requested"),
  [campaign]);

  const hasApproved = useMemo(() =>
    reviews.some((r: any) => r.action === "approved"),
  [reviews]);

  const addTimestamp = (seconds: number) => {
    setCommentTimestamp(seconds);
    setComment((prev) => prev + ` [${formatTime(seconds)}] `);
  };

  const handleApprove = async () => {
    if (!campaign || !submission) return;
    setActionLoading("approve");
    try {
      const version = versions.length + 1;
      await addArtistReview({ campaignId: campaign.campaignId, version, action: "approved", comment });
      if (comment.trim() || commentTimestamp !== null) {
        addReviewComment({ token: "", campaignId: campaign.campaignId, text: comment, timestampSeconds: commentTimestamp, version, author: "artist" });
      }
      await updateCampaign(campaign.campaignId, { status: "Approved By Artist" } as any);
      addNotification("artist_approved", "Artist Approved ✅",
        `${campaign.artistName} approved the final version for ${campaign.campaignId}.`, campaign.campaignId, "high");
      if (submission) {
        const updated = { ...submission, status: "approved" as const, reviewedAt: new Date().toISOString() };
        saveEditorSubmission(updated);
      }
      logReviewAction(campaign.campaignId, submission?.editorId || "", "approved");
      logArtistApproved(campaign.campaignId, campaign.artistName || "Artist", version);
      if (comment.trim()) logArtistComment(campaign.campaignId, comment);
      setCampaign(await getCampaigns().then((all) => all.find((c) => c.campaignId === campaign.campaignId) || campaign));
      setApproved(true);
      setReviews(getArtistReviews(campaign.campaignId));
      setComments(getReviewComments(campaign.campaignId));
    } catch (e) { console.error("[TrackPage] approve failed:", e); }
    setActionLoading(null);
  };

  const handleRequestChanges = async () => {
    if (!campaign || !comment.trim()) return;
    setActionLoading("revision");
    try {
      const version = versions.length + 1;
      await addArtistReview({ campaignId: campaign.campaignId, version, action: "revision_requested", comment });
      addReviewComment({ token: "", campaignId: campaign.campaignId, text: comment, timestampSeconds: commentTimestamp, version, author: "artist" });
      await updateCampaign(campaign.campaignId, { status: "Artist Revision Requested" } as any);
      addNotification("artist_revision_requested", "Revision Requested 🔄",
        `${campaign.artistName} requested changes for ${campaign.campaignId}: "${comment}"`, campaign.campaignId, "high");
      if (submission) {
        const updated = { ...submission, status: "needs_revision" as const, adminNotes: comment, reviewedAt: new Date().toISOString() };
        saveEditorSubmission(updated);
      }
      logReviewAction(campaign.campaignId, submission?.editorId || "", "revision_requested", comment);
      logArtistComment(campaign.campaignId, comment);
      setCampaign(await getCampaigns().then((all) => all.find((c) => c.campaignId === campaign.campaignId) || campaign));
      setReviews(getArtistReviews(campaign.campaignId));
      setComments(getReviewComments(campaign.campaignId));
    } catch (e) { console.error("[TrackPage] revision failed:", e); }
    setActionLoading(null);
  };

  const goToWhatsApp = (msg: string) => {
    window.open(`https://wa.me/${WA_PHONE}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const videoFile = submission?.files.find((f) => f.fileType === "edited_video");

  const getDisplayStatus = (): { text: string; color: string } => {
    if (approved) return { text: "Approved By You", color: "text-emerald-400" };
    switch (campaign?.status) {
      case "Pending Verification": return { text: "Awaiting Verification", color: "text-yellow-400" };
      case "Assigned":
      case "Editing":
      case "Pending Admin Review":
      case "Needs Revision": return { text: "In Production", color: "text-blue-400" };
      case "Pending Artist Review": return { text: "Waiting For Your Approval", color: "text-pink-400" };
      case "Artist Revision Requested": return { text: "Editor Is Updating", color: "text-amber-400" };
      case "Approved By Artist": return { text: "Approved", color: "text-teal-400" };
      case "Ready To Schedule":
      case "Template Created": return { text: "Ready For Scheduling", color: "text-sky-400" };
      case "Scheduled": return { text: "Scheduled", color: "text-sky-400" };
      case "Posted": return { text: "Live On TikTok", color: "text-red-400" };
      case "Completed": return { text: "Completed", color: "text-emerald-400" };
      default: return { text: campaign?.status || "Unknown", color: "text-zinc-400" };
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {campaign && <ArtistNotificationToast campaignId={campaign.campaignId} />}

      <header className="border-b border-white/[0.04] bg-black/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <a href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center font-bold text-xs">
              S
            </div>
            <span className="font-semibold text-sm tracking-tight hidden sm:block">
              SharpConnect
            </span>
          </a>
          <div className="flex items-center gap-3 text-xs text-zinc-600">
            <span>Track</span>
            <span className="w-0.5 h-0.5 rounded-full bg-zinc-700" />
            <a href="/" className="hover:text-zinc-300 transition-colors">Home</a>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 sticky-footer-offset">
        <section className="pt-10 pb-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Track Your{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600">
                Campaign
              </span>
            </h1>
            <p className="mt-2 text-sm text-zinc-600">Enter your Campaign ID</p>
          </motion.div>

          <motion.form
            onSubmit={handleSearch}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="mt-6 max-w-sm mx-auto"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={lookupId}
                onChange={(e) => setLookupId(e.target.value)}
                placeholder="SC-ABCD1234"
                className="flex-1 bg-transparent border border-white/[0.08] rounded-xl px-4 py-3.5 text-sm text-white placeholder:text-zinc-700 outline-none transition-all duration-200 focus:border-red-500/50"
              />
              <button
                type="submit"
                disabled={animating}
                className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold text-sm transition-all duration-200 disabled:opacity-50 shadow-lg shadow-red-500/10"
              >
                {animating ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin block" />
                ) : (
                  "Track"
                )}
              </button>
            </div>
          </motion.form>
        </section>

        <AnimatePresence mode="wait">
          {campaign && (
            <motion.div
              key={campaign.campaignId}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="pb-6 border-b border-white/[0.04]">
                <div className="flex items-center gap-2 text-[10px] text-zinc-600 mb-3">
                  <code className="font-mono text-red-400 bg-red-500/[0.06] px-2 py-0.5 rounded">
                    {campaign.campaignId}
                  </code>
                  <span className="text-zinc-700">/</span>
                  <span>{campaign.packageName || "Standard Promo"}</span>
                  <span className="text-zinc-700">/</span>
                  <span>{formatCurrency(campaign.total)}</span>
                </div>

                <div className="flex items-start gap-4">
                  <span
                    className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${
                      approved
                        ? "bg-emerald-500"
                        : campaign.status === "Completed"
                          ? "bg-emerald-500"
                          : campaign.status === "Pending Verification"
                            ? "bg-yellow-500"
                            : campaign.status === "Pending Artist Review"
                              ? "bg-pink-500"
                              : campaign.status === "Artist Revision Requested"
                                ? "bg-amber-500"
                                : campaign.status === "Approved By Artist"
                                  ? "bg-teal-500"
                                  : "bg-blue-500"
                    }`}
                  />
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">
                      {(() => {
                        const ds = getDisplayStatus();
                        return <span className={ds.color}>{ds.text}</span>;
                      })()}
                    </h2>
                    <p className="text-sm text-zinc-400 mt-1">
                      {campaign.artistName}
                      <span className="text-zinc-700 mx-2">—</span>
                      {campaign.songTitle}
                    </p>
                  </div>
                </div>
              </div>

              <div className="py-8 border-b border-white/[0.04]">
                <div className="relative pl-8">
                  {statusFlow.map((step, i) => {
                    const isComplete = i <= currentIndex;
                    const isCurrent = i === currentIndex;
                    const showAsComplete = approved && step.status === "Approved By Artist";
                    const done = isComplete || showAsComplete;
                    return (
                      <div key={step.status} className="relative pb-8 last:pb-0">
                        {i < statusFlow.length - 1 && (
                          <div
                            className={`absolute left-[11px] top-5 w-0.5 h-[calc(100%+0px)] ${
                              done
                                ? "bg-gradient-to-b from-red-500/60 to-red-500/10"
                                : "bg-white/[0.04]"
                            }`}
                          />
                        )}
                        <div className="flex items-start gap-4">
                          <div
                            className={`w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 text-[9px] transition-all duration-500 mt-0.5 ${
                              done
                                ? "bg-red-600 shadow-lg shadow-red-500/20"
                                : "bg-white/[0.04]"
                            } ${isCurrent && !approved ? "ring-2 ring-red-500/40 ring-offset-2 ring-offset-black animate-pulse" : ""}`}
                          >
                            {done ? (
                              <span className="text-[8px]">{step.icon}</span>
                            ) : (
                              <span className="text-zinc-600">{i + 1}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <p
                              className={`text-sm font-medium ${
                                done ? "text-white" : "text-zinc-600"
                              }`}
                            >
                              {approved && step.status === "Approved By Artist"
                                ? "Approved By You"
                                : step.label}
                            </p>
                            <p
                              className={`text-xs ${
                                done ? "text-zinc-500" : "text-zinc-700"
                              }`}
                            >
                              {step.desc}
                            </p>
                          </div>
                          {(isCurrent || (approved && step.status === "Approved By Artist")) && (
                            <span className="text-[9px] text-red-400/60 font-medium shrink-0 pt-0.5">
                              {approved && step.status === "Approved By Artist" ? "Done" : "Now"}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {isReviewable && (
                <>
                  <AnimatePresence>
                    {approved && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="py-6 border-b border-white/[0.04]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-emerald-400">Approved — moving to scheduling</p>
                            <p className="text-xs text-zinc-500 mt-0.5">You&apos;ll get a notification when it&apos;s live.</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {!approved && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="py-6 border-b border-white/[0.04]">
                        <div className="flex items-center gap-2 mb-4">
                          <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                          <p className="text-xs font-semibold text-pink-300 uppercase tracking-wider">Review Your Video</p>
                          {versions.length > 0 && (
                            <span className="text-[9px] text-zinc-600 font-mono ml-auto">
                              v{versions.length}
                            </span>
                          )}
                        </div>

                        {videoFile ? (
                          <div className="rounded-xl overflow-hidden bg-black/60 border border-white/[0.04]">
                            <video
                              controls
                              className="w-full max-h-[70vh] object-contain"
                              src={videoFile.fileUrl}
                              playsInline
                            />
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
                            <p className="text-sm text-zinc-400 font-medium">Video Not Ready Yet</p>
                            <p className="text-xs text-zinc-600 mt-1">Your edit is being prepared. Check back soon.</p>
                          </div>
                        )}

                        {submission &&
                          (() => {
                            const extras = submission.files.filter((f) => f.fileType !== "edited_video");
                            if (extras.length === 0) return null;
                            return (
                              <div className="flex gap-2 mt-3">
                                {extras.map((f, i) => (
                                  <a
                                    key={i}
                                    href={f.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                                  >
                                    <svg className="w-3 h-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    {f.fileName || f.fileType}
                                  </a>
                                ))}
                              </div>
                            );
                          })()}
                      </div>
                    </motion.div>
                  )}
                </>
              )}

              <div className="py-6 border-b border-white/[0.04]">
                <h3 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-4">Details</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
                  {[
                    { label: "Package", value: campaign.packageName || "Standard Promo" },
                    { label: "Amount", value: formatCurrency(campaign.total) },
                    { label: "Submitted", value: formatDate(campaign.submittedAt) },
                    {
                      label: "Status",
                      value: (() => {
                        if (approved) return "Approved By You";
                        switch (campaign.status) {
                          case "Pending Verification": return "Awaiting Verification";
                          case "Assigned":
                          case "Editing":
                          case "Pending Admin Review":
                          case "Needs Revision": return "In Production";
                          case "Template Created":
                          case "Ready To Schedule":
                          case "Approved By Artist": return "Approved";
                          case "Pending Artist Review": return "Waiting For Your Approval";
                          case "Artist Revision Requested": return "Editor Updating";
                          default: return campaign.status;
                        }
                      })(),
                    },
                  ].map((f) => (
                    <div key={f.label}>
                      <p className="text-[10px] text-zinc-600 mb-0.5">{f.label}</p>
                      <p className="text-sm text-white font-medium">{f.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {comments.length > 0 && !approved && (
                <div className="py-6 border-b border-white/[0.04]">
                  <h3 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-4">Comments</h3>
                  <div className="space-y-3">
                    {comments.map((c) => (
                      <div key={c.id} className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full mt-2 bg-pink-500 shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {c.timestampSeconds !== null && (
                              <span className="text-[9px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                                {formatTime(c.timestampSeconds)}
                              </span>
                            )}
                            <span className="text-[9px] text-zinc-600">
                              {new Date(c.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-zinc-300 mt-0.5">{c.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reviews.length > 0 && !approved && (
                <div className="py-6 border-b border-white/[0.04]">
                  <h3 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-4">Review History</h3>
                  <div className="space-y-3">
                    {reviews.map((r) => (
                      <div key={r.id} className="flex items-start gap-3">
                        <div
                          className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${
                            r.action === "approved" ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="text-sm text-white font-medium capitalize">
                            {r.action.replace("_", " ")}
                          </p>
                          {r.comment && (
                            <p className="text-xs text-zinc-400 mt-0.5">{r.comment}</p>
                          )}
                          <p className="text-[9px] text-zinc-600 mt-1">
                            {new Date(r.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {campaign &&
                (campaign.status === "Approved By Artist" ||
                  campaign.status === "Ready To Schedule" ||
                  campaign.status === "Scheduled" ||
                  campaign.status === "Posted" ||
                  campaign.status === "Completed") &&
                (() => {
                  const schedules = getCampaignSchedules(campaign.campaignId);
                  if (schedules.length === 0) {
                    if (campaign.status === "Ready To Schedule") {
                      return (
                        <div className="py-6 border-b border-white/[0.04]">
                          <h3 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-1">
                            Schedule
                          </h3>
                          <p className="text-sm text-white font-medium mt-2">Ready to be scheduled</p>
                          <p className="text-xs text-zinc-500 mt-0.5">Your campaign will be scheduled for posting soon.</p>
                        </div>
                      );
                    }
                    return null;
                  }
                  const nextSchedule = schedules.find(
                    (s) => s.postingStatus !== "Posted" && s.postingStatus !== "Reposted"
                  );
                  return (
                    <div className="py-6 border-b border-white/[0.04]">
                      <h3 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-4">
                        Schedule
                      </h3>
                      <div className="space-y-3">
                        {schedules.map((sch) => {
                          const isPosted = sch.postingStatus === "Posted" || sch.postingStatus === "Reposted";
                          const isNext = !isPosted && sch === nextSchedule;
                          const dt = new Date(`${sch.scheduledDate}T${sch.scheduledTime}`);
                          return (
                            <div key={sch.id} className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                                  isPosted
                                    ? "bg-emerald-500/10 text-emerald-400"
                                    : isNext
                                      ? "bg-sky-500/10 text-sky-400"
                                      : "bg-white/[0.04] text-zinc-500"
                                }`}
                              >
                                {isPosted ? "✓" : isNext ? "📅" : "○"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white">{sch.platformName}</p>
                                <p className="text-xs text-zinc-500">
                                  {isPosted
                                    ? `Posted ${dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                                    : isNext
                                      ? `Scheduled ${dt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} at ${sch.scheduledTime}`
                                      : `${dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} at ${sch.scheduledTime}`}
                                </p>
                              </div>
                              {sch.postUrl && sch.verificationStatus === "verified" && (
                                <a
                                  href={sch.postUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-red-400 hover:text-red-300 shrink-0"
                                >
                                  View Post →
                                </a>
                              )}
                              {sch.postUrl && sch.verificationStatus === "pending_verification" && (
                                <span className="text-[10px] text-amber-500 shrink-0">Pending verification</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

              {approved &&
                campaign.status !== "Approved By Artist" &&
                campaign.status !== "Ready To Schedule" && (
                  <div className="py-6 border-b border-white/[0.04]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-emerald-400">Approved & Ready for Scheduling</p>
                        <p className="text-xs text-zinc-500 mt-0.5">Campaign approved — will be scheduled for TikTok soon.</p>
                      </div>
                    </div>
                  </div>
                )}

              <div className="py-6">
                <p className="text-xs text-zinc-600 mb-3">Need help?</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => goToWhatsApp(`Hi SharpConnect, I have a question about my campaign ${campaign.campaignId}.`)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366]/[0.06] text-[#25D366] text-xs font-semibold hover:bg-[#25D366]/[0.1] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    WhatsApp
                  </button>
                  <a
                    href={`mailto:support@sharpconnect.com?subject=Campaign%20${campaign.campaignId}`}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/[0.06] text-red-400 text-xs font-semibold hover:bg-red-500/[0.1] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Email
                  </a>
                </div>
              </div>
            </motion.div>
          )}

          {notFound && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-10"
            >
              <div className="w-14 h-14 mx-auto rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-base font-semibold text-red-400">Campaign Not Found</p>
              <p className="text-sm text-zinc-500 mt-1">Double-check your Campaign ID and try again.</p>
              {!campaign && (
                <button
                  onClick={() => goToWhatsApp("Hi SharpConnect, I need help finding my campaign ID.")}
                  className="mt-5 px-5 py-2.5 rounded-xl bg-[#25D366]/[0.06] text-[#25D366] text-xs font-semibold hover:bg-[#25D366]/[0.1] transition-colors"
                >
                  Get Help on WhatsApp
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {isReviewable && !approved && (
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-black/95 backdrop-blur-2xl border-t border-white/[0.04] p-4 safe-area-bottom">
          <div className="max-w-3xl mx-auto">
            {videoFile && (
              <div className="flex gap-1.5 overflow-x-auto hide-scrollbar mb-3">
                {[0, 3, 7, 14, 21, 30].map((s) => (
                  <button
                    key={s}
                    onClick={() => addTimestamp(s)}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.04] text-[9px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
                  >
                    {formatTime(s)}
                  </button>
                ))}
              </div>
            )}

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={actionLoading === "revision" ? "Describe what changes you'd like..." : "Optional feedback..."}
              rows={1}
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-700 outline-none transition-all duration-200 focus:border-pink-500/50 resize-none mb-3"
            />

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleRequestChanges}
                disabled={actionLoading !== null || !comment.trim()}
                className="py-4 rounded-xl border border-amber-500/25 text-amber-400 text-sm font-semibold disabled:opacity-40 active:scale-[0.98] transition-transform touch-target"
              >
                {actionLoading === "revision" ? (
                  <span className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin block mx-auto" />
                ) : (
                  "Request Changes"
                )}
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading !== null}
                className="py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 text-white text-sm font-semibold disabled:opacity-40 active:scale-[0.98] transition-transform touch-target shadow-lg shadow-emerald-500/10"
              >
                {actionLoading === "approve" ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin block mx-auto" />
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

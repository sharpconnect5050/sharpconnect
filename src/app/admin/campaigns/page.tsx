"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCampaigns, updateCampaign, formatDate, formatCurrency, type Campaign, type CampaignStatus } from "@/lib/adminData";
import { logEvent } from "@/lib/events";
import { runStatusChangeWorkflow } from "@/lib/workflows";
import MediaSection from "@/components/MediaSection";
import { EDITORS, getEditorByCampaignEditor, buildTelegramMessage, buildTelegramDeepLink, assignCampaign as saveAssignment, createEditorTask, getCampaignSubmission, saveEditorSubmission, getEditorById } from "@/lib/editors";
import { logReviewAction } from "@/lib/reviews";
import { addAlert } from "@/components/AdminNotifications";
import PaymentReviewModal from "@/components/PaymentReviewModal";
import { createReviewToken, getReviewTokenByCampaign, getArtistReviews } from "@/lib/artistReview";
import { STATUS_META, PRIORITY_META, StatusBadge, PriorityBadge, StatusDot } from "@/lib/statusConfig";
import { getSiteUrl } from "@/lib/config";
import ActivityTimeline from "@/components/ActivityTimeline";
import {
  logEditorAssigned, logAdminApproved, logRevisionRequested,
  logStatusOverride, logCampaignScheduled, logNoteAdded, logPriorityChanged,
  logPaymentApproved, logPaymentRejected, dispatchCampaignStatus,
} from "@/lib/activity-log";

/* statusColors and priorityColors are now imported from @/lib/statusConfig */

const STATUS_GROUPS: { label: string; statuses: CampaignStatus[] }[] = [
  { label: "Payment", statuses: ["Pending Verification", "Paid"] },
  { label: "Production", statuses: ["Assigned", "Editing", "Pending Admin Review", "Needs Revision", "Approved", "Pending Artist Review", "Artist Revision Requested", "Approved By Artist", "Ready To Schedule", "Template Created"] },
  { label: "Delivery", statuses: ["Scheduled", "Posted", "Completed"] },
  { label: "Void", statuses: ["Rejected"] },
];

function CampaignCard({ c, onSelect }: { c: Campaign; onSelect: (c: Campaign) => void }) {
  const sm = STATUS_META[c.status as keyof typeof STATUS_META];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onSelect(c)}
      className="relative glass-card-premium p-4 active:scale-[0.98] transition-transform cursor-pointer hover:border-white/[0.15] group overflow-hidden"
    >
      <div className="absolute top-0 left-0 right-0 h-px opacity-40" style={{ background: `linear-gradient(90deg, transparent, ${sm?.glow || "#ef4444"}, transparent)` }} />
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-red-700/20 flex items-center justify-center text-sm font-bold text-red-400 shrink-0 border border-red-500/10">
            {c.artistName.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{c.artistName}</p>
            <p className="text-xs text-zinc-500 truncate">{c.songTitle}</p>
          </div>
        </div>
        <code className="text-[9px] font-mono text-red-400/60 bg-red-500/8 px-2 py-0.5 rounded shrink-0 ml-2 border border-red-500/10">{c.campaignId}</code>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <StatusBadge status={c.status as any} />
        <PriorityBadge priority={c.priority as any} />
        {c.editor && c.editor !== "Unassigned" && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/[0.04] text-zinc-500 border border-white/[0.06]">{c.editor}</span>
        )}
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.05]">
        <span className="text-[10px] text-zinc-700 tabular-nums">{formatDate(c.submittedAt)}</span>
        <span className="text-xs font-semibold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600">{formatCurrency(c.total)}</span>
      </div>
    </motion.div>
  );
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [mobilePanel, setMobilePanel] = useState(false);
  const [detailTab, setDetailTab] = useState<"overview" | "assignment" | "media" | "history">("overview");
  const [paymentReviewCampaign, setPaymentReviewCampaign] = useState<Campaign | null>(null);
  const [reviewTokenMap, setReviewTokenMap] = useState<Record<string, { token: string }>>({});

  useEffect(() => {
    let mounted = true;
    getCampaigns().then((d) => { if (mounted) setCampaigns(d); }).catch(console.error);
    return () => { mounted = false; };
  }, []);

  const filtered = campaigns.filter((c) => {
    const q = search.toLowerCase();
    const name = (c.artistName || "").toLowerCase();
    const song = (c.songTitle || "").toLowerCase();
    const id = (c.campaignId || "").toLowerCase();
    const matchesSearch = name.includes(q) || song.includes(q) || id.includes(q);
    const matchesStatus = statusFilter === "All" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleUpdate = async (id: string, updates: Partial<Campaign>) => {
    try {
      const prev = campaigns.find((c) => c.campaignId === id);
      await updateCampaign(id, updates);
      setCampaigns((current) => current.map((c) => (c.campaignId === id ? { ...c, ...updates } : c)));
      if (updates.status && prev && prev.status !== updates.status) {
        await logEvent(id, "manual_override", { from: prev.status, to: updates.status, field: "status" });
        await runStatusChangeWorkflow(id, updates.status);
        logStatusOverride(id, "admin", prev.status, updates.status);
        dispatchCampaignStatus(id, prev.status, updates.status, "admin");
      }
      if (updates.editor && prev && prev.editor !== updates.editor) {
        await logEvent(id, "editor_assigned", { editor: updates.editor, previous: prev.editor });
        logEditorAssigned(id, updates.editor, "admin");
      }
      if (updates.priority && prev && prev.priority !== updates.priority) {
        await logEvent(id, "priority_changed", { priority: updates.priority, previous: prev.priority });
        logPriorityChanged(id, "admin", prev.priority, updates.priority);
      }
      if (selected?.campaignId === id) setSelected({ ...selected, ...updates });
    } catch { /* update failed */ }
  };

  const selectCampaign = (c: Campaign) => {
    if (c.status === "Pending Verification") {
      setPaymentReviewCampaign(c);
      return;
    }
    setSelected(c);
    setMobilePanel(true);
    setDetailTab("overview");
  };

  const statuses = ["All", "Pending Verification", "Paid", "Assigned", "Editing", "Pending Admin Review", "Needs Revision", "Approved", "Template Created", "Scheduled", "Posted", "Completed"];

  const detailTabs = [
    { id: "overview" as const, label: "Overview", icon: "info" },
    { id: "assignment" as const, label: "Assignment", icon: "edit" },
    { id: "media" as const, label: "Media", icon: "media" },
    { id: "history" as const, label: "History", icon: "history" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Campaigns</h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">{campaigns.length} total</p>
        </div>
        <div className="flex gap-1.5">
          {(["All", "Pending Admin Review", "Needs Revision", "Paid", "Completed"] as const).map((f) => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`px-2.5 py-1.5 rounded-full text-[10px] font-medium border transition-all touch-target ${
                statusFilter === f ? "bg-red-600 text-white border-red-600" : "border-white/10 text-zinc-500 hover:border-white/20"
              }`}
            >{f === "All" ? "All" : f}</button>
          ))}
        </div>
      </div>

      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search artist, song or ID..."
          className="w-full bg-transparent border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-red-500/50"
        />
      </div>

      <div className="lg:grid lg:grid-cols-3 lg:gap-6">
        {/* ─── LIST ─── */}
        <div className={`lg:col-span-2 ${mobilePanel ? "hidden lg:block" : ""}`}>
          <div className="hidden lg:block overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-[10px] text-zinc-600 uppercase tracking-[0.08em]">
                  <th className="px-4 py-3.5 font-medium w-8"></th>
                  <th className="px-4 py-3.5 font-medium">Campaign</th>
                  <th className="px-4 py-3.5 font-medium">Status</th>
                  <th className="px-4 py-3.5 font-medium">Pri</th>
                  <th className="px-4 py-3.5 font-medium">Progress</th>
                  <th className="px-4 py-3.5 font-medium">Editor</th>
                  <th className="px-4 py-3.5 font-medium">Total</th>
                  <th className="px-4 py-3.5 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => {
                  const sm = STATUS_META[c.status as keyof typeof STATUS_META];
                  const pm = PRIORITY_META[c.priority];
                  const statusIdx = ([..."Pending Verification","Paid","Assigned","Editing","Pending Admin Review","Needs Revision","Approved","Pending Artist Review","Artist Revision Requested","Approved By Artist","Ready To Schedule","Template Created","Scheduled","Posted","Completed","Rejected"] as const).indexOf(c.status as any);
                  const pct = Math.min(Math.round(((statusIdx + 1) / 16) * 100), 100);
                  return (
                  <motion.tr key={c.campaignId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }}
                    onClick={() => selectCampaign(c)}
                    className={`border-b border-white/[0.04] cursor-pointer transition-all duration-200 hover:bg-white/[0.04] group ${
                      selected?.campaignId === c.campaignId ? "bg-red-500/8 border-l-2 border-l-red-500" : "border-l-2 border-l-transparent"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span className="text-[10px] text-zinc-700 font-mono group-hover:text-zinc-500 transition-colors">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500/20 to-red-700/20 flex items-center justify-center text-xs font-bold text-red-400 shrink-0 border border-red-500/10 group-hover:scale-105 transition-transform">
                          {c.artistName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-zinc-200 truncate group-hover:text-white transition-colors">{c.artistName}</p>
                          <p className="text-[10px] text-zinc-600 truncate">{c.songTitle}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status as any} />
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={c.priority as any} />
                    </td>
                    <td className="px-4 py-3 w-28">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-white/[0.06] overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                            className="h-full rounded-full"
                            style={{ background: `linear-gradient(90deg, ${sm?.glow || "#ef4444"}, ${sm?.glow || "#ef4444"}88)`, boxShadow: `0 0 6px ${sm?.glow || "#ef4444"}33` }}
                          />
                        </div>
                        <span className="text-[9px] text-zinc-600 font-mono w-6 text-right">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-zinc-500 truncate max-w-[110px] group-hover:text-zinc-400 transition-colors">
                      {c.editor && c.editor !== "Unassigned" ? c.editor : <span className="text-zinc-700">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-zinc-300 tabular-nums">{formatCurrency(c.total)}</td>
                    <td className="px-4 py-3 text-[10px] text-zinc-700 whitespace-nowrap tabular-nums">{formatDate(c.submittedAt)}</td>
                  </motion.tr>
                )})}
              </tbody>
            </table>
            {filtered.length === 0 && <p className="text-sm text-zinc-600 text-center py-8">No campaigns found</p>}
          </div>

          <div className="lg:hidden space-y-3">
            {filtered.map((c, i) => (
              <CampaignCard key={c.campaignId} c={c} onSelect={selectCampaign} />
            ))}
            {filtered.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 text-center">
                <p className="text-sm text-zinc-600">No campaigns found</p>
              </div>
            )}
          </div>
        </div>

        {/* ─── DETAIL PANEL ─── */}
        <div className={`${!mobilePanel ? "hidden lg:block" : "fixed inset-0 z-50 lg:relative lg:inset-auto"} ${mobilePanel ? "block" : ""}`}>
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={selected.campaignId}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={`${mobilePanel ? "bg-[#0a0a0a] h-full overflow-y-auto" : ""}`}
              >
                {/* Mobile header bar */}
                {mobilePanel && (
                  <div className="sticky top-0 z-10 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/[0.08] flex items-center justify-between px-4 h-12">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-gradient-to-br from-red-500/20 to-red-700/20 flex items-center justify-center text-[8px] font-bold text-red-400">{selected.artistName.charAt(0)}</div>
                      <span className="text-sm font-semibold">{selected.artistName}</span>
                    </div>
                    <button onClick={() => setMobilePanel(false)} className="p-2 text-zinc-400 hover:text-white">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* ─── HEADER SECTION ─── */}
                <div className="p-4 space-y-3 pb-24">
                  <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-transparent backdrop-blur-xl p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-lg font-bold">{selected.artistName}</p>
                        <p className="text-xs text-zinc-400">{selected.songTitle}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-[10px] font-mono text-red-400 bg-red-500/10 px-2 py-0.5 rounded">{selected.campaignId}</code>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={selected.status as any} />
                      <PriorityBadge priority={selected.priority as any} />
                      {selected.editor && selected.editor !== "Unassigned" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/[0.04] text-zinc-500 border border-white/[0.06]">{selected.editor}</span>
                      )}
                      <span className="text-[10px] text-zinc-700 ml-auto tabular-nums">{formatDate(selected.submittedAt)}</span>
                    </div>
                  </div>

                  {/* ─── TAB NAV ─── */}
                  <div className="flex gap-1 rounded-xl border border-white/[0.08] bg-white/[0.04] p-1">
                    {detailTabs.map((t) => (
                      <button key={t.id} onClick={() => setDetailTab(t.id)}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                          detailTab === t.id ? "bg-red-600 text-white" : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* ─── TAB: OVERVIEW ─── */}
                  {detailTab === "overview" && (
                    <div className="space-y-3">
                      {/* Info grid */}
                      <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-4">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                          {[
                            { label: "TikTok", value: selected.tiktokHandle },
                            { label: "WhatsApp", value: selected.whatsapp },
                            { label: "Email", value: selected.email },
                            { label: "Package", value: selected.packageName },
                            { label: "Sound", value: selected.soundOption === "slow-reverb" ? "Slow + Reverb" : selected.soundOption === "fast" ? "Fast" : "Original" },
                            { label: "Total", value: formatCurrency(selected.total) },
                          ].map((f) => (
                            <div key={f.label}>
                              <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">{f.label}</p>
                              <p className="text-white text-xs truncate">{f.value}</p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 pt-4 border-t border-white/[0.08]">
                          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Creative Direction</p>
                          <p className="text-xs text-zinc-300 leading-relaxed">{selected.creativeDirection}</p>
                        </div>
                        {selected.selectedTags?.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-white/[0.08]">
                            <div className="flex flex-wrap gap-1.5">
                              {selected.selectedTags.map((tag) => (
                                <span key={tag} className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[10px]">{tag}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Payment info */}
                      <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-4">
                        <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Payment</h4>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                          {[
                            { label: "Sender", value: selected.senderName },
                            { label: "Number", value: selected.senderNumber },
                            { label: "Amount", value: selected.amountSent },
                            { label: "Transaction", value: selected.transactionId },
                          ].map((f) => (
                            <div key={f.label}>
                              <p className="text-[10px] text-zinc-600">{f.label}</p>
                              <p className="text-white text-xs">{f.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Contact client */}
                      <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-4">
                        <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Contact Client</h4>
                        <div className="flex gap-2">
                          <a href={`https://wa.me/${selected.whatsapp.replace("+", "")}?text=Hi%20${encodeURIComponent(selected.artistName)}%2C%20this%20is%20SharpConnect%20regarding%20your%20campaign%20${encodeURIComponent(selected.campaignId)}.`}
                            target="_blank" rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] text-xs font-semibold active:scale-[0.98] transition-transform"
                          >
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                            WhatsApp
                          </a>
                          <a href={`mailto:${selected.email}?subject=SharpConnect%20Campaign%20${selected.campaignId}`}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold active:scale-[0.98] transition-transform"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            Email
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ─── TAB: ASSIGNMENT ─── */}
                  {detailTab === "assignment" && (
                    <div className="space-y-3">
                      {/* Status Selector */}
                      <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-4">
                        <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Status</h4>
                        <div className="flex flex-col gap-1.5">
                          {STATUS_GROUPS.map((group) => (
                            <div key={group.label} className="flex items-center gap-2">
                              <span className="text-[9px] text-zinc-600 uppercase tracking-wider w-16 shrink-0">{group.label}</span>
                              <div className="flex gap-1 flex-wrap">
                                {group.statuses.map((s) => (
                                  <button key={s} onClick={() => handleUpdate(selected.campaignId, { status: s })}
                                    className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all touch-target ${
                                      selected.status === s ? "bg-red-600 text-white border-red-600 shadow-lg shadow-red-600/20" : "border-white/[0.08] text-zinc-500 hover:border-white/20 hover:text-zinc-300"
                                    }`}
                                  >{s === "Pending Admin Review" ? "Review" : s === "Pending Verification" ? "Pending" : s}</button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Priority */}
                      <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-4">
                        <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Priority</h4>
                        <div className="flex gap-2">
                          {(["Low", "Medium", "High", "Urgent"] as const).map((p) => (
                            <button key={p} onClick={() => handleUpdate(selected.campaignId, { priority: p })}
                              className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all touch-target ${
                                selected.priority === p ? "bg-red-600 text-white border-red-600" : "border-white/[0.08] text-zinc-500 hover:border-white/20"
                              }`}
                            >{p}</button>
                          ))}
                        </div>
                      </div>

                      {/* Editor Assignment */}
                      <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-4">
                        <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Assign Campaign</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {EDITORS.map((editor) => {
                            const isAssigned = selected.editor === editor.name;
                            return (
                              <button key={editor.id}
                                onClick={async () => {
                                  await handleUpdate(selected.campaignId, { editor: editor.name, status: "Assigned" });
                                  saveAssignment(editor.id, selected.campaignId);
                                  const taskId = createEditorTask(editor.id, selected.campaignId);
                                  const origin = getSiteUrl();
                                  const mediaUrl = `${origin}/editor-task/${taskId}/media`;
                                  const submitUrl = `${origin}/editor-task/${taskId}`;
                                  const msg = buildTelegramMessage(editor, {
                                    campaignId: selected.campaignId,
                                    artistName: selected.artistName,
                                    songTitle: selected.songTitle,
                                    creativeDirection: selected.creativeDirection,
                                    packageName: selected.packageName,
                                    tiktokHandle: selected.tiktokHandle,
                                    soundOption: selected.soundOption,
                                  }, mediaUrl, submitUrl);
                                  window.open(buildTelegramDeepLink(editor.telegram, msg), "_blank");
                                  navigator.clipboard.writeText(msg);
                                  addAlert("campaign_started", `Campaign ${selected.campaignId} assigned to ${editor.name}`, selected.campaignId);
                                }}
                                className={`relative flex items-center gap-2.5 p-3 rounded-xl border text-xs font-medium transition-all active:scale-[0.97] touch-target ${
                                  isAssigned ? "bg-gradient-to-br " + editor.gradient + " border-white/20 text-white" : "border-white/[0.08] text-zinc-400 hover:border-white/20 hover:text-white"
                                }`}
                              >
                                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${editor.color} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}>
                                  {editor.initials}
                                </div>
                                <div className="text-left min-w-0 flex-1">
                                  <p className="text-[11px] font-medium truncate">{editor.brand}</p>
                                  <p className="text-[9px] opacity-60 truncate">{editor.telegram}</p>
                                </div>
                                {isAssigned && (
                                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
                                    <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Review sections */}
                      {selected.status === "Pending Admin Review" && (() => {
                        const sub = getCampaignSubmission(selected.campaignId);
                        if (!sub) return null;
                        const editorProfile = getEditorById(sub.editorId);
                        const editedVideo = sub.files.find((f) => f.fileType === "edited_video");
                        const templateFile = sub.files.find((f) => f.fileType === "completed_template");
                        const exportFile = sub.files.find((f) => f.fileType === "export_file");
                        return (
                          <div className="rounded-xl border border-purple-500/20 bg-purple-500/[0.04] backdrop-blur-xl p-4">
                            <h4 className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider mb-3">Review Submission</h4>
                            {editorProfile && (
                              <div className="flex items-center gap-2.5 mb-3 p-2.5 rounded-lg bg-white/[0.04]">
                                <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${editorProfile.color} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}>{editorProfile.initials}</div>
                                <div className="text-xs text-zinc-300">{editorProfile.name}</div>
                                <div className="text-[10px] text-zinc-600 ml-auto">{new Date(sub.submittedAt).toLocaleDateString()}</div>
                              </div>
                            )}
                            <div className="space-y-2 mb-3">
                              {editedVideo && (
                                <div>
                                  <p className="text-[10px] text-zinc-500 mb-1">Edited Video</p>
                                  <div className="rounded-xl overflow-hidden bg-black/60">
                                    <video controls className="w-full max-h-44 object-contain" src={editedVideo.fileUrl} />
                                  </div>
                                </div>
                              )}
                              {templateFile && (
                                <a href={templateFile.fileUrl} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.04] text-xs text-zinc-300 hover:text-white"
                                >
                                  <svg className="w-3.5 h-3.5 text-purple-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                  <span className="truncate">{templateFile.fileName}</span>
                                </a>
                              )}
                              {exportFile && (
                                <a href={exportFile.fileUrl} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.04] text-xs text-zinc-300 hover:text-white"
                                >
                                  <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                  <span className="truncate">{exportFile.fileName}</span>
                                </a>
                              )}
                              {sub.notes && <p className="text-xs text-zinc-400 bg-white/[0.04] rounded-xl p-2.5">{sub.notes}</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <button onClick={async () => {
                                await handleUpdate(selected.campaignId, { status: "Ready To Schedule" });
                                const updated = getCampaignSubmission(selected.campaignId);
                                if (updated) { updated.status = "approved"; updated.reviewedAt = new Date().toISOString(); saveEditorSubmission(updated); }
                                logReviewAction(selected.campaignId, updated?.editorId || "", "approved");
                                logAdminApproved(selected.campaignId, "admin", 0);
                                addAlert("campaign_started", `Edit approved for ${selected.campaignId} — ready to schedule`, selected.campaignId);
                              }}
                                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-semibold active:scale-[0.98] transition-all"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                Approve & Mark Ready
                              </button>
                              <button onClick={() => {
                                const reason = prompt("Revision notes for editor:");
                                if (!reason) return;
                                handleUpdate(selected.campaignId, { status: "Needs Revision" });
                                const updated = getCampaignSubmission(selected.campaignId);
                                if (updated) { updated.status = "needs_revision"; updated.adminNotes = reason; updated.reviewedAt = new Date().toISOString(); saveEditorSubmission(updated); }
                                logReviewAction(selected.campaignId, updated?.editorId || "", "revision_requested", reason);
                                logRevisionRequested(selected.campaignId, "admin", "admin", reason, 0);
                                addAlert("campaign_started", `Revision requested for ${selected.campaignId}`, selected.campaignId);
                              }}
                                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold active:scale-[0.98] transition-all"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                Revise
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      {selected.status === "Needs Revision" && (() => {
                        const sub = getCampaignSubmission(selected.campaignId);
                        if (!sub) return null;
                        return (
                          <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.04] backdrop-blur-xl p-4">
                            <h4 className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider mb-2">Revision Requested</h4>
                            {sub.adminNotes && <p className="text-xs text-zinc-300 bg-white/[0.04] rounded-xl p-2.5 mb-2">{sub.adminNotes}</p>}
                            <p className="text-xs text-zinc-500">Waiting for editor re-submission</p>
                          </div>
                        );
                      })()}

                      {/* Telegram share */}
                      {selected.editor && selected.editor !== "Unassigned" && (() => {
                        const editor = getEditorByCampaignEditor(selected.editor);
                        if (!editor) return null;
                        const taskId = createEditorTask(editor.id, selected.campaignId);
                        const origin = getSiteUrl();
                        const mediaUrl = `${origin}/editor-task/${taskId}/media`;
                        const submitUrl = `${origin}/editor-task/${taskId}`;
                        const msg = buildTelegramMessage(editor, {
                          campaignId: selected.campaignId, artistName: selected.artistName, songTitle: selected.songTitle,
                          creativeDirection: selected.creativeDirection, packageName: selected.packageName,
                          tiktokHandle: selected.tiktokHandle, soundOption: selected.soundOption,
                        }, mediaUrl, submitUrl);
                        return (
                          <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-4">
                            <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                              <svg className="w-3.5 h-3.5 text-[#0088cc]" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                              Telegram
                            </h4>
                            <div className="flex items-center gap-2.5 mb-3 p-2.5 rounded-lg bg-white/[0.04]">
                              <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${editor.color} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}>{editor.initials}</div>
                              <div className="text-xs text-zinc-300">{editor.name}</div>
                              <span className="text-[10px] text-[#0088cc] ml-auto">{editor.telegram}</span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-[#17212b] border border-white/[0.05] mb-3">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <div className="w-4 h-4 rounded-full bg-[#0088cc] flex items-center justify-center text-[6px] font-bold text-white">S</div>
                                <span className="text-[9px] text-zinc-500">SharpConnect Bot</span>
                              </div>
                              <p className="text-[11px] text-zinc-300 whitespace-pre-wrap leading-relaxed line-clamp-3">{msg}</p>
                            </div>
                            <div className="space-y-2 mb-3">
                              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                <span className="text-[9px] text-blue-400 shrink-0">Media:</span>
                                <input readOnly value={mediaUrl} onClick={(e) => (e.target as HTMLInputElement).select()}
                                  className="flex-1 bg-transparent text-[10px] text-zinc-300 outline-none truncate" />
                                <button onClick={() => navigator.clipboard.writeText(mediaUrl)}
                                  className="text-[10px] text-blue-400 hover:text-blue-300 shrink-0">Copy</button>
                              </div>
                              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-green-500/10 border border-green-500/20">
                                <span className="text-[9px] text-green-400 shrink-0">Submit:</span>
                                <input readOnly value={submitUrl} onClick={(e) => (e.target as HTMLInputElement).select()}
                                  className="flex-1 bg-transparent text-[10px] text-zinc-300 outline-none truncate" />
                                <button onClick={() => navigator.clipboard.writeText(submitUrl)}
                                  className="text-[10px] text-green-400 hover:text-green-300 shrink-0">Copy</button>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <a href={buildTelegramDeepLink(editor.telegram, msg)} target="_blank" rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#0088cc] hover:bg-[#33a0e0] text-white text-xs font-semibold active:scale-[0.98] transition-all"
                              >
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                                Open Telegram
                              </a>
                              <button onClick={() => navigator.clipboard.writeText(msg)}
                                className="px-3 py-2.5 rounded-xl border border-white/[0.08] text-zinc-400 hover:text-white text-xs font-medium active:scale-[0.98] transition-all"
                              >Copy</button>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Artist Review Link — Token-based */}
                      {["Pending Artist Review", "Artist Revision Requested", "Approved By Artist"].includes(selected.status) && (() => {
                        const rt = reviewTokenMap[selected.campaignId]?.token
                          ? { token: reviewTokenMap[selected.campaignId].token }
                          : getReviewTokenByCampaign(selected.campaignId);
                        const reviews = getArtistReviews(selected.campaignId);
                        const lastReview = reviews[0];
                        const origin = getSiteUrl();
                        const reviewUrl = rt ? `${origin}/review/${rt.token}` : "";
                        return (
                          <div className="rounded-xl border border-pink-500/20 bg-pink-500/[0.04] backdrop-blur-xl p-4">
                            <h4 className="text-[11px] font-semibold text-pink-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              Artist Review Link
                            </h4>

                            {lastReview && (
                              <div className="mb-3 p-2.5 rounded-lg bg-white/[0.04] flex items-center gap-2.5">
                                <div className={`w-2 h-2 rounded-full shrink-0 ${lastReview.action === "approved" ? "bg-emerald-500" : "bg-amber-500"}`} />
                                <span className="text-[10px] text-zinc-400 capitalize">{lastReview.action.replace("_", " ")}</span>
                                {lastReview.comment && <span className="text-[10px] text-zinc-600 truncate">— "{lastReview.comment}"</span>}
                                <span className="text-[9px] text-zinc-700 ml-auto">{new Date(lastReview.createdAt).toLocaleDateString()}</span>
                              </div>
                            )}

                            {!rt ? (
                              <button onClick={() => {
                                const newToken = createReviewToken(selected.campaignId);
                                setReviewTokenMap((prev) => ({ ...prev, [selected.campaignId]: { token: newToken.token } }));
                              }}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-pink-600/20 border border-pink-500/30 text-pink-400 text-xs font-semibold active:scale-[0.98] transition-all touch-target hover:bg-pink-600/30"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                Generate Review Link
                              </button>
                            ) : (
                              <>
                                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-pink-500/10 border border-pink-500/20">
                                  <input readOnly value={reviewUrl} onClick={(e) => (e.target as HTMLInputElement).select()}
                                    className="flex-1 bg-transparent text-[10px] text-zinc-300 outline-none truncate" />
                                  <button onClick={() => navigator.clipboard.writeText(reviewUrl)}
                                    className="text-[10px] text-pink-400 hover:text-pink-300 shrink-0">Copy</button>
                                </div>
                                {selected.whatsapp && (
                                  <button onClick={() => {
                                    const msg = `Hi ${selected.artistName}, your campaign ${selected.campaignId} is ready for review. Please check and approve the final version here: ${reviewUrl}`;
                                    window.open(`https://wa.me/${selected.whatsapp.replace("+", "")}?text=${encodeURIComponent(msg)}`, "_blank");
                                  }}
                                    className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] text-xs font-semibold active:scale-[0.98] transition-all touch-target"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                                    Send via WhatsApp
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* ─── TAB: MEDIA ─── */}
                  {detailTab === "media" && (
                    <div className="space-y-3">
                      <MediaSection
                        campaignId={selected.campaignId}
                        audioUrl={selected.audioUrl}
                        videoUrl={selected.videoUrl}
                        tiktokSoundLink={selected.tiktokSoundLink}
                      />
                    </div>
                  )}

                  {/* ─── TAB: HISTORY ─── */}
                  {detailTab === "history" && (
                    <div className="space-y-3">
                      <ActivityTimeline campaignId={selected.campaignId} maxHeight="max-h-[400px]" />
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="hidden lg:flex flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-10 text-center min-h-[400px]"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-700/20 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm text-zinc-500 font-medium">Select a campaign</p>
                <p className="text-xs text-zinc-600 mt-1">Click any campaign row to view details</p>
              </motion.div>
            )}
        </AnimatePresence>
      </div>
      </div>
      {/* Payment Review Modal */}
      <AnimatePresence>
        {paymentReviewCampaign && (
          <PaymentReviewModal
            campaign={paymentReviewCampaign}
            onClose={() => setPaymentReviewCampaign(null)}
            onApproved={(id) => {
              setPaymentReviewCampaign(null);
              const c = campaigns.find((x) => x.campaignId === id);
              logPaymentApproved(id, "admin", c ? `$${c.packagePrice}` : "—");
              getCampaigns().then(setCampaigns).catch(console.error);
            }}
            onRejected={(id) => {
              setPaymentReviewCampaign(null);
              logPaymentRejected(id, "admin", "Payment rejected during review");
              getCampaigns().then(setCampaigns).catch(console.error);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

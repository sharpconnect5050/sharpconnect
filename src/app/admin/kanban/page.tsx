"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCampaigns, updateCampaign, formatCurrency, type Campaign, type CampaignStatus } from "@/lib/adminData";
import { STATUS_META } from "@/lib/statusConfig";

/* ─── PIPELINE STAGES ────────────────────────────────────── */

interface StageDef {
  id: string;
  label: string;
  icon: string;
  statuses: CampaignStatus[];
  accent: string;
  accentBorder: string;
  accentGlow: string;
  bgGradient: string;
}

const STAGES: StageDef[] = [
  {
    id: "incoming", label: "Incoming", icon: "📥",
    statuses: ["Pending Verification", "Paid"],
    accent: "#f59e0b", accentBorder: "border-t-amber-500", accentGlow: "rgba(245,158,11,0.15)",
    bgGradient: "from-amber-500/[0.03] to-transparent",
  },
  {
    id: "production", label: "Production", icon: "🎬",
    statuses: ["Assigned", "Editing"],
    accent: "#3b82f6", accentBorder: "border-t-blue-500", accentGlow: "rgba(59,130,246,0.15)",
    bgGradient: "from-blue-500/[0.03] to-transparent",
  },
  {
    id: "review", label: "Review", icon: "🔍",
    statuses: ["Pending Admin Review", "Needs Revision"],
    accent: "#a855f7", accentBorder: "border-t-purple-500", accentGlow: "rgba(168,85,247,0.15)",
    bgGradient: "from-purple-500/[0.03] to-transparent",
  },
  {
    id: "artist", label: "Artist", icon: "👀",
    statuses: ["Pending Artist Review", "Artist Revision Requested", "Approved By Artist"],
    accent: "#ec4899", accentBorder: "border-t-pink-500", accentGlow: "rgba(236,72,153,0.15)",
    bgGradient: "from-pink-500/[0.03] to-transparent",
  },
  {
    id: "ready", label: "Ready", icon: "🚀",
    statuses: ["Ready To Schedule", "Template Created"],
    accent: "#06b6d4", accentBorder: "border-t-cyan-500", accentGlow: "rgba(6,182,212,0.15)",
    bgGradient: "from-cyan-500/[0.03] to-transparent",
  },
  {
    id: "live", label: "Live", icon: "🔥",
    statuses: ["Scheduled", "Posted", "Completed"],
    accent: "#22c55e", accentBorder: "border-t-emerald-500", accentGlow: "rgba(34,197,94,0.15)",
    bgGradient: "from-emerald-500/[0.03] to-transparent",
  },
  {
    id: "void", label: "Void", icon: "🚫",
    statuses: ["Rejected"],
    accent: "#6b7280", accentBorder: "border-t-zinc-500", accentGlow: "rgba(107,114,128,0.15)",
    bgGradient: "from-zinc-500/[0.03] to-transparent",
  },
];

const STATUS_TO_STAGE = new Map<string, string>();
for (const stage of STAGES) {
  for (const s of stage.statuses) {
    STATUS_TO_STAGE.set(s, stage.id);
  }
}

/* ─── HELPERS ────────────────────────────────────────────── */

function daysInStage(submittedAt: string): number {
  return Math.floor((Date.now() - new Date(submittedAt).getTime()) / 86400000);
}

function stageProgress(current: string): number {
  const idx = STAGES.findIndex((s) => s.statuses.includes(current as CampaignStatus));
  return idx >= 0 ? Math.round((idx / (STAGES.length - 1)) * 100) : 0;
}

/* ─── CAMPAIGN CARD ──────────────────────────────────────── */

function CampaignCard({ c, isDragging, onDragStart, accent }: {
  c: Campaign; isDragging: boolean; onDragStart: (id: string) => void; accent: string;
}) {
  const meta = STATUS_META[c.status as keyof typeof STATUS_META];
  const days = daysInStage(c.submittedAt);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      draggable
      onDragStart={() => onDragStart(c.campaignId)}
      className={`relative rounded-xl border border-white/[0.06] bg-[#0a0a0a] p-3 cursor-grab active:cursor-grabbing transition-all hover:border-white/[0.15] group select-none ${
        isDragging ? "opacity-40 scale-[0.97] ring-2 ring-white/10" : ""
      }`}
    >
      {/* Accent bar */}
      <div className="absolute top-0 left-3 right-3 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />

      {/* Top row */}
      <div className="flex items-center justify-between mb-2">
        <code className="text-[8px] font-mono text-zinc-600 bg-white/[0.03] px-1.5 py-0.5 rounded">{c.campaignId}</code>
        <div className="flex items-center gap-1">
          {c.priority && c.priority !== "Medium" && (
            <span className={`px-1 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider ${
              c.priority === "Urgent" ? "bg-red-500/20 text-red-400" :
              c.priority === "High" ? "bg-orange-500/20 text-orange-400" :
              "bg-zinc-500/20 text-zinc-400"
            }`}>
              {c.priority}
            </span>
          )}
          <span className="text-[9px] font-medium text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600">
            {formatCurrency(c.total)}
          </span>
        </div>
      </div>

      {/* Artist + song */}
      <p className="text-xs font-semibold text-white truncate">{c.artistName}</p>
      <p className="text-[10px] text-zinc-600 truncate mb-2">{c.songTitle}</p>

      {/* Bottom row */}
      <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {c.editor && c.editor !== "Unassigned" ? (
            <>
              <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-red-500/30 to-red-700/30 flex items-center justify-center text-[6px] font-bold text-red-400 shrink-0">
                {c.editor.charAt(0)}
              </div>
              <span className="text-[9px] text-zinc-600 truncate">{c.editor}</span>
            </>
          ) : (
            <span className="text-[9px] text-zinc-700">Unassigned</span>
          )}
        </div>
        <span className={`text-[8px] font-mono shrink-0 ml-2 ${days > 3 ? "text-red-500" : "text-zinc-600"}`}>
          {days === 0 ? "Today" : `${days}d`}
        </span>
      </div>

      {/* Stage indicator */}
      <div className="mt-2 h-0.5 rounded-full bg-white/[0.04] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${stageProgress(c.status)}%` }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${accent}, ${accent}88)`, boxShadow: `0 0 4px ${accent}44` }}
        />
      </div>
    </motion.div>
  );
}

/* ─── COLUMN ─────────────────────────────────────────────── */

function StageColumn({ stage, campaigns, dragging, onDragStart, onDrop }: {
  stage: StageDef; campaigns: Campaign[]; dragging: string | null;
  onDragStart: (id: string) => void; onDrop: (campaignId: string, newStage: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  const items = useMemo(() =>
    campaigns.filter((c) => stage.statuses.includes(c.status as CampaignStatus)),
  [campaigns, stage]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (dragging) onDrop(dragging, stage.id);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative w-64 shrink-0 rounded-2xl border ${stage.accentBorder} transition-all duration-200 ${
        dragOver ? "border-white/20 bg-white/[0.06]" : "border-white/[0.06] bg-white/[0.02]"
      }`}
      style={{ boxShadow: dragOver ? `0 0 30px ${stage.accentGlow}` : "none" }}
    >
      {/* Header */}
      <div className={`sticky top-0 z-10 p-3 border-b border-white/[0.06] rounded-t-2xl ${stage.bgGradient}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs">{stage.icon}</span>
            <h3 className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">{stage.label}</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-zinc-600 bg-white/[0.04] px-2 py-0.5 rounded-full">{items.length}</span>
            {stage.id === "live" && items.length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            )}
        </div>
      </div>
        {/* Progress mini-bar */}
        <div className="mt-2 h-0.5 rounded-full bg-white/[0.04] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min((items.length / 20) * 100, 100)}%` }}
            className="h-full rounded-full"
            style={{ background: stage.accent, boxShadow: `0 0 6px ${stage.accent}44` }}
          />
        </div>
      </div>

      {/* Cards */}
      <div className="p-2.5 space-y-2 min-h-[120px] max-h-[calc(100vh-280px)] overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {items.map((c) => (
            <CampaignCard key={c.campaignId} c={c} isDragging={dragging === c.campaignId}
              onDragStart={onDragStart} accent={stage.accent} />
          ))}
        </AnimatePresence>

        {items.length === 0 && !dragOver && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-8 h-8 rounded-full bg-white/[0.02] flex items-center justify-center mb-2">
              <svg className="w-4 h-4 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <p className="text-[10px] text-zinc-700">Drop campaign here</p>
          </div>
        )}

        {dragOver && (
          <div className="flex items-center justify-center py-8 rounded-xl border-2 border-dashed border-white/[0.08]">
            <p className="text-[10px] text-zinc-600">Drop to move to {stage.label}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── PAGE ───────────────────────────────────────────────── */

export default function PipelineBoard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getCampaigns().then((d) => { if (mounted) setCampaigns(d); }).catch(console.error).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const handleDragStart = useCallback((id: string) => setDragging(id), []);

  const handleDrop = useCallback(async (_campaignId: string, targetStageId: string) => {
    if (!dragging) return;
    const c = campaigns.find((x) => x.campaignId === dragging);
    if (!c) return;

    const targetStage = STAGES.find((s) => s.id === targetStageId);
    if (!targetStage) return;

    if (targetStage.statuses.includes(c.status as CampaignStatus)) {
      setDragging(null);
      return;
    }

    const newStatus = targetStage.statuses[0];

    if (c.status === "Pending Verification" && newStatus !== "Paid") {
      setDragging(null);
      return;
    }

    try {
      await updateCampaign(dragging, { status: newStatus } as any);
      const updated = await getCampaigns();
      setCampaigns(updated);
    } catch { /* drop failed */ }
    setDragging(null);
  }, [dragging, campaigns]);

  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter((c) => c.status !== "Completed" && c.status !== "Rejected").length;
  const liveCount = campaigns.filter((c) => c.status === "Posted" || c.status === "Scheduled").length;

  const filtered = useMemo(() => {
    if (!search.trim()) return campaigns;
    const q = search.toLowerCase();
    return campaigns.filter((c) =>
      c.campaignId.toLowerCase().includes(q) ||
      c.artistName.toLowerCase().includes(q) ||
      c.songTitle.toLowerCase().includes(q)
    );
  }, [campaigns, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ─── HEADER ─── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Pipeline</h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1 flex items-center gap-2">
            <span>{totalCampaigns} total</span>
            <span className="w-1 h-1 rounded-full bg-zinc-700" />
            <span className="text-emerald-400">{activeCampaigns} active</span>
            <span className="w-1 h-1 rounded-full bg-zinc-700" />
            <span className="text-blue-400">{liveCount} live</span>
          </p>
        </div>

        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter cards..."
            className="w-44 bg-transparent border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-zinc-700 outline-none focus:border-red-500/50"
          />
        </div>
      </div>

      {/* ─── PIPELINE ─── */}
      <div className="overflow-x-auto pb-4 -mx-4 px-4">
        <div className="flex gap-3 min-w-max">
          {STAGES.map((stage) => (
            <StageColumn key={stage.id} stage={stage} campaigns={filtered}
              dragging={dragging} onDragStart={handleDragStart} onDrop={handleDrop} />
          ))}
        </div>
      </div>

      {/* ─── KEY ─── */}
      <div className="flex flex-wrap items-center gap-3 text-[10px] text-zinc-600 border-t border-white/[0.06] pt-4">
        <span className="font-medium">Days in stage color:</span>
        <span className="text-zinc-600">&lt; 3d</span>
        <span className="text-red-500">&gt; 3d</span>
        <span className="w-px h-3 bg-zinc-800" />
        <span>Drag cards between columns</span>
      </div>
    </div>
  );
}

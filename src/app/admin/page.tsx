"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCampaigns, getStats, formatCurrency, type Campaign } from "@/lib/adminData";
import { STATUS_META, PRIORITY_META } from "@/lib/statusConfig";
import CommandCenterMetrics from "@/components/CommandCenterMetrics";
import ActivityTimelineWidget from "@/components/dashboard/ActivityTimelineWidget";
import ActivityVolumeWidget from "@/components/dashboard/ActivityVolumeWidget";
import ActivityStatsWidget from "@/components/dashboard/ActivityStatsWidget";

const STATUS_GROUP = {
  Payment: ["Pending Verification", "Paid"] as const,
  Production: ["Assigned", "Editing", "Pending Admin Review", "Needs Revision", "Approved", "Ready To Schedule", "Template Created"] as const,
  Delivery: ["Scheduled", "Posted", "Completed"] as const,
};

const GROUP_META: Record<string, { color: string; glow: string }> = {
  Payment: { color: "from-amber-400 to-amber-600", glow: "#f59e0b" },
  Production: { color: "from-blue-400 to-blue-600", glow: "#3b82f6" },
  Delivery: { color: "from-emerald-400 to-emerald-600", glow: "#22c55e" },
};

function PipelineBar({ counts, total }: { counts: Record<string, number>; total: number }) {
  const segments = Object.entries(STATUS_META).map(([status, meta]) => {
    const count = counts[status] || 0;
    return { status, meta, count, pct: total > 0 ? (count / total) * 100 : 0 };
  }).filter((s) => s.count > 0);

  if (segments.length === 0) return null;

  return (
    <div className="space-y-2.5">
      <div className="flex h-2 rounded-full overflow-hidden bg-white/[0.04] p-[1px]">
        {segments.map((s) => (
          <motion.div key={s.status} initial={{ width: 0 }} animate={{ width: `${s.pct}%` }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="first:rounded-l-full last:rounded-r-full relative"
            style={{ background: s.meta.glow, opacity: 0.7 }}
            title={`${s.status}: ${s.count}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] text-zinc-600">
        {segments.map((s) => (
          <span key={s.status} className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.meta.glow, boxShadow: `0 0 4px ${s.meta.glow}` }} />
            {s.meta.shortLabel} <strong className="text-zinc-300">{s.count}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function CommandCenter() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [currentTime, setCurrentTime] = useState("");
  const [animateMetrics, setAnimateMetrics] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getCampaigns().then((d) => { if (mounted) setCampaigns(d); }).catch(console.error).finally(() => { if (mounted) setLoading(false); });
    const interval = setInterval(() => getCampaigns().then((d) => { if (mounted) setCampaigns(d); }), 10000);
    setAnimateMetrics(true);
    return () => { clearInterval(interval); mounted = false; };
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setCurrentTime(new Date().toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const stats = useMemo(() => getStats(campaigns), [campaigns]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    campaigns.forEach((c) => { counts[c.status] = (counts[c.status] || 0) + 1; });
    return counts;
  }, [campaigns]);

  const metricItems = useMemo(() => [
    {
      id: "active",
      label: "Active Campaigns",
      value: String(campaigns.length),
      icon: "📡",
      glowColor: "#ef4444",
      pulseColor: "#ef4444",
    },
    {
      id: "revenue",
      label: "Revenue Today",
      value: formatCurrency(stats.revenue),
      icon: "💰",
      glowColor: "#22c55e",
      pulseColor: "#22c55e",
    },
    {
      id: "pending",
      label: "Pending Payments",
      value: String(stats.pendingVerification),
      icon: "⏳",
      glowColor: "#f59e0b",
      pulseColor: "#f59e0b",
    },
    {
      id: "review",
      label: "Pending Reviews",
      value: String(stats.pendingReview),
      icon: "🔍",
      glowColor: "#a855f7",
      pulseColor: "#a855f7",
    },
    {
      id: "scheduled",
      label: "Posts Today",
      value: String(campaigns.filter((c) => c.status === "Scheduled" || c.status === "Ready To Schedule").length),
      icon: "📅",
      glowColor: "#0ea5e9",
      pulseColor: "#0ea5e9",
    },
    {
      id: "overdue",
      label: "Needs Attention",
      value: String(campaigns.filter((c) => c.priority === "Urgent" || c.status === "Pending Admin Review").length),
      icon: "⚠️",
      glowColor: "#f43f5e",
      pulseColor: "#f43f5e",
    },
  ], [campaigns, stats]);

  const needsAttention = useMemo(() =>
    campaigns.filter((c) => c.status === "Pending Verification" || c.status === "Pending Admin Review" || c.priority === "Urgent").slice(0, 6),
  [campaigns]);

  const recent = useMemo(() => [...campaigns].slice(0, 5), [campaigns]);

  const activeEditors = useMemo(() => {
    return new Set(campaigns.filter((c) => c.editor && c.editor !== "Unassigned").map((c) => c.editor)).size;
  }, [campaigns]);

  const PipelineOverview = useCallback(() => {
    return (
      <div className="glass-card-premium p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)]" />
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-[0.08em]">Pipeline</h3>
          </div>
          <a href="/admin/kanban" className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">Full view →</a>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {Object.entries(STATUS_GROUP).map(([group, statuses]) => {
            const count = statuses.reduce((sum, s) => sum + (statusCounts[s] || 0), 0);
            const meta = GROUP_META[group];
            return (
              <div key={group} className="text-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.04] relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${meta?.glow || "#ef4444"}44, transparent)` }} />
                <p className={`text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r ${meta?.color || ""}`}>
                  {count}
                </p>
                <p className="text-[10px] text-zinc-600 mt-0.5 tracking-wide">{group}</p>
              </div>
            );
          })}
        </div>

        <PipelineBar counts={statusCounts} total={campaigns.length} />
      </div>
    );
  }, [statusCounts, campaigns.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-[1600px] mx-auto">
      {/* ─── HEADER ─── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Command Center</h1>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-semibold text-emerald-400 tracking-wider uppercase flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-emerald-500 live-dot" />
              Live
            </span>
          </div>
          <p className="text-xs text-zinc-600 mt-1 flex items-center gap-2">
            <span>{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} tracked</span>
            <span className="w-1 h-1 rounded-full bg-zinc-700" />
            <span>{activeEditors} active editor{activeEditors !== 1 ? "s" : ""}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-mono text-zinc-500">{currentTime}</p>
          <p className="text-[9px] text-zinc-700 mt-0.5">UTC</p>
        </div>
      </div>

      {/* ─── METRICS ─── */}
      <CommandCenterMetrics items={metricItems} />

      {/* ─── ATTENTION ROW ─── */}
      <AnimatePresence>
        {needsAttention.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="rounded-xl border border-red-500/15 bg-red-500/[0.03] p-4"
          >
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse-urgent" />
              <h3 className="text-sm font-semibold text-red-400">Flags</h3>
              <span className="px-1.5 py-0.5 rounded-full bg-red-500/10 text-[10px] text-red-400 font-medium">{needsAttention.length}</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {needsAttention.map((c) => {
                const sm = STATUS_META[c.status as keyof typeof STATUS_META];
                return (
                  <a key={c.campaignId} href="/admin/campaigns"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-all border border-transparent hover:border-white/[0.06] group"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${sm?.dot || "bg-zinc-500"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-zinc-300 truncate font-medium group-hover:text-white transition-colors">{c.artistName}</p>
                      <p className="text-[10px] text-zinc-600 truncate">{c.songTitle} · {c.campaignId}</p>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${sm?.badge?.split(" ").slice(0, 3).join(" ") || ""}`}>
                      {c.status === "Pending Verification" ? "Payment" : c.status === "Pending Admin Review" ? "Review" : c.priority}
                    </span>
                  </a>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── MAIN GRID ─── */}
      <div className="grid xl:grid-cols-5 gap-5">
        {/* Left — Pipeline + Recent */}
        <div className="xl:col-span-3 space-y-5">
          <PipelineOverview />

          {/* Recent campaigns */}
          <div className="glass-card-premium p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-zinc-500" />
                <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-[0.08em]">Recent Campaigns</h3>
              </div>
              <a href="/admin/campaigns" className="text-[10px] text-red-500 hover:text-red-400 transition-colors">View all →</a>
            </div>
            {recent.length === 0 ? (
              <p className="text-sm text-zinc-700 text-center py-8">No campaigns yet</p>
            ) : (
              <div className="space-y-1">
                {recent.map((c, i) => {
                  const sm = STATUS_META[c.status as keyof typeof STATUS_META];
                  const pm = PRIORITY_META[c.priority];
                  return (
                    <a key={c.campaignId} href="/admin/campaigns"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-all group border border-transparent hover:border-white/[0.06]"
                    >
                      <span className="text-[11px] text-zinc-700 w-5 shrink-0 text-right font-mono">{String(i + 1).padStart(2, "0")}</span>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${sm?.dot || "bg-zinc-500"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-zinc-300 truncate font-medium group-hover:text-white transition-colors">{c.artistName}</p>
                        <p className="text-[10px] text-zinc-600 truncate">{c.songTitle}</p>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${pm?.badge?.split(" ").slice(0, 3).join(" ") || "text-zinc-500"}`}>
                        {c.priority}
                      </span>
                      <span className="text-xs font-semibold text-zinc-400 tabular-nums">{formatCurrency(c.total)}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${sm?.badge?.split(" ").slice(0, 4).join(" ") || ""}`}>
                        {sm?.shortLabel || c.status}
                      </span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right — Activity Widgets + Quick Actions */}
        <div className="xl:col-span-2 space-y-5">
          <ActivityTimelineWidget />
          <ActivityVolumeWidget />
          <ActivityStatsWidget />

          <div className="glass-card-premium p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(251,191,36,0.5)]" />
              <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-[0.08em]">Operations</h3>
            </div>

            <div className="space-y-1">
              <OpLink label="Review Payments" href="/admin/payments" badge={stats.pendingVerification} color="text-amber-400" />
              <OpLink label="Review Submissions" href="/admin/reviews" badge={stats.pendingReview} color="text-purple-400" />
              <OpLink label="Pipeline Board" href="/admin/kanban" />
              <OpLink label="Manage Editors" href="/admin/editors" />
              <OpLink label="Schedule Posts" href="/admin/scheduling" badge={campaigns.filter((c) => c.status === "Ready To Schedule").length} color="text-sky-400" />
              <OpLink label="Analytics" href="/admin/analytics" />
              <OpLink label="Automation" href="/admin/automation" />
            </div>

            <div className="mt-4 pt-4 border-t border-white/[0.05] space-y-2">
              <MiniStat label="Active editors" value={String(activeEditors)} />
              <MiniStat label="Completed" value={String(stats.completed)} />
              <MiniStat label="Pending payment" value={String(stats.pendingVerification)} />
              <MiniStat label="In production" value={String(stats.inProduction)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OpLink({ label, href, badge, color }: { label: string; href: string; badge?: number; color?: string }) {
  return (
    <a href={href}
      className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/[0.03] active:scale-[0.99] transition-all text-sm group border border-transparent hover:border-white/[0.06]"
    >
      <span className="text-zinc-500 group-hover:text-zinc-300 transition-colors">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className={`px-1.5 py-0.5 rounded-full bg-amber-500/10 text-[10px] font-medium ${color || "text-zinc-400"}`}>
          {badge}
        </span>
      )}
    </a>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[11px]">
      <span className="text-zinc-600">{label}</span>
      <span className="text-zinc-300 font-medium tabular-nums">{value}</span>
    </div>
  );
}

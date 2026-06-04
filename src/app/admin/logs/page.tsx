"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  queryActivityLogs, groupActivitiesByDate, formatActivityTime,
  formatActivityTimestamp, actorDisplay, subscribeToActivity,
  onRealtimeStatusChange, getRealtimeStatus, downloadActivityLog,
  exportActivityLogToCSV, exportActivityLogToJSON, exportActivityLogToPDF,
  computeActivityStats, ACTIVITY_CATEGORIES, DATE_RANGE_PRESETS,
  getDateRangeFromPreset,
  type ActivityEntry, type ActivityCategory, type ActorType,
  type ActivityLogQuery,
} from "@/lib/activity-log";

/* ─── CONSTANTS ───────────────────────────────────────────── */

type ViewMode = "timeline" | "list";
type FilterTab = "all" | ActivityCategory;

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "approval", label: "Approvals" },
  { key: "revision", label: "Revisions" },
  { key: "payment", label: "Payments" },
  { key: "scheduling", label: "Scheduling" },
  { key: "posting", label: "Posting" },
  { key: "comment", label: "Comments" },
  { key: "assignment", label: "Assignments" },
  { key: "ai", label: "AI" },
  { key: "system", label: "System" },
];

const ACTOR_FILTERS: { key: ActorType | "all"; label: string }[] = [
  { key: "all", label: "All Roles" },
  { key: "admin", label: "Admin" },
  { key: "artist", label: "Artist" },
  { key: "editor", label: "Editor" },
  { key: "ai", label: "AI" },
  { key: "system", label: "System" },
];

const EMPTY_MESSAGES: Record<string, string> = {
  all: "No activity events recorded yet",
  approval: "No approvals recorded",
  revision: "No revisions recorded",
  payment: "No payment events",
  scheduling: "No scheduling events",
  posting: "No posting events",
  comment: "No comments",
  assignment: "No assignments",
  ai: "No AI alerts",
  system: "No system events",
};

/* ─── ROLE BADGE COLOR ───────────────────────────────────── */

function roleBadgeColor(role: string): string {
  switch (role) {
    case "admin":  return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    case "artist": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "editor": return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    case "ai":     return "bg-orange-500/10 text-orange-400 border-orange-500/20";
    default:       return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  }
}

/* ─── COMPACT TIMESTAMP ───────────────────────────────────── */

function compactTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `Today ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  if (days === 1) return `Yesterday ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/* ─── ACTIVITY CARD ──────────────────────────────────────── */

function ActivityCard({ entry }: { entry: ActivityEntry }) {
  const meta = ACTIVITY_CATEGORIES[entry.category];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="rounded-xl border backdrop-blur-xl p-3 relative overflow-hidden"
      style={{
        borderColor: `${meta.glow.replace("0.4)", "0.15)")}`,
        backgroundColor: `${meta.glow.replace("0.4)", "0.03)")}`,
      }}
    >
      <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
        style={{ background: `linear-gradient(to bottom, ${meta.glow.replace("0.4)", "1)")}, transparent)` }}
      />
      <div className="flex items-start gap-3 pl-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 ${meta.bg}`}>
          {meta.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-white/90">{entry.title}</span>
            <span className="text-[10px] text-zinc-600 font-mono">{compactTimestamp(entry.timestamp)}</span>
            <code className="text-[9px] font-mono text-red-400/50 bg-red-500/8 px-1.5 py-0.5 rounded border border-red-500/10">
              {entry.campaignId}
            </code>
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed line-clamp-2">{entry.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full border ${roleBadgeColor(entry.actorRole)}`}>
              {actorDisplay(entry.actor, entry.actorRole)}
            </span>
            {entry.version && (
              <span className="text-[9px] font-mono text-zinc-600 bg-white/[0.04] px-1.5 py-0.5 rounded">v{entry.version}</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── LIST ROW ───────────────────────────────────────────── */

function ListRow({ entry }: { entry: ActivityEntry }) {
  const meta = ACTIVITY_CATEGORIES[entry.category];
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="border-b border-white/[0.04] hover:bg-white/[0.04] transition-colors"
    >
      <td className="px-3 py-2.5 text-[10px] text-zinc-500 font-mono whitespace-nowrap tabular-nums">
        {compactTimestamp(entry.timestamp)}
      </td>
      <td className="px-3 py-2.5">
        <code className="text-[9px] font-mono text-red-400/60 bg-red-500/8 px-1.5 py-0.5 rounded border border-red-500/10">
          {entry.campaignId}
        </code>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px]">{meta.icon}</span>
          <span className="text-[11px] text-zinc-300">{entry.title}</span>
        </div>
      </td>
      <td className="px-3 py-2.5 text-[11px] text-zinc-500 max-w-[220px] truncate">
        {entry.description}
      </td>
      <td className="px-3 py-2.5">
        <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full border ${roleBadgeColor(entry.actorRole)}`}>
          {actorDisplay(entry.actor, entry.actorRole)}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-[10px] text-zinc-600 capitalize">{entry.category}</span>
      </td>
    </motion.tr>
  );
}

/* ─── STATS BAR ───────────────────────────────────────────── */

function StatsBar({ entries }: { entries: ActivityEntry[] }) {
  const stats = useMemo(() => computeActivityStats(entries.slice(0, 5000)), [entries]);
  if (stats.total === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {[
        { label: "Total Events", value: stats.total, color: "text-zinc-300" },
        { label: "Campaigns", value: stats.uniqueCampaigns, color: "text-blue-400" },
        { label: "Priority", value: stats.priorityCount, color: "text-amber-400" },
        { label: "Admins", value: stats.byActorRole.admin, color: "text-blue-400" },
        { label: "Artists", value: stats.byActorRole.artist, color: "text-emerald-400" },
        { label: "Editors", value: stats.byActorRole.editor, color: "text-purple-400" },
        { label: "AI", value: stats.byActorRole.ai, color: "text-orange-400" },
        { label: "System", value: stats.byActorRole.system, color: "text-zinc-400" },
      ].map((s) => (
        <div key={s.label} className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
          <p className="text-[9px] text-zinc-600 uppercase tracking-wider">{s.label}</p>
          <p className={`text-sm font-semibold ${s.color} tabular-nums`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

/* ─── EXPORT DROPDOWN ─────────────────────────────────────── */

function ExportDropdown({ entries }: { entries: ActivityEntry[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-zinc-300 hover:text-white hover:bg-white/[0.04] transition-all"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        Export
        <svg className={`w-3 h-3 text-zinc-600 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute right-0 top-full mt-1 w-40 rounded-xl border border-white/[0.08] bg-[#0a0a0a] backdrop-blur-2xl shadow-2xl z-50 overflow-hidden"
          >
            <button onClick={() => { downloadActivityLog(entries, "csv"); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-zinc-300 hover:bg-white/[0.04] hover:text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
            <button onClick={() => { downloadActivityLog(entries, "json"); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-zinc-300 hover:bg-white/[0.04] hover:text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export JSON
            </button>
            <button onClick={() => { exportActivityLogToPDF(entries); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-zinc-300 hover:bg-white/[0.04] hover:text-white border-t border-white/[0.06] transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.535 48.535 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
              </svg>
              Export PDF
            </button>
            <button onClick={() => {
              navigator.clipboard.writeText(exportActivityLogToCSV(entries));
              setOpen(false);
            }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-zinc-300 hover:bg-white/[0.04] hover:text-white transition-colors border-t border-white/[0.06]"
            >
              <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy CSV
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── MAIN PAGE ───────────────────────────────────────────── */

export default function ActivityLogPage() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  /* Filters */
  const [category, setCategory] = useState<FilterTab>("all");
  const [actorRole, setActorRole] = useState<ActorType | "all">("all");
  const [datePreset, setDatePreset] = useState<number | null>(null); // days or null
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [campaignIdFilter, setCampaignIdFilter] = useState("");

  /* View */
  const [view, setView] = useState<ViewMode>("timeline");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [realtimeOnline, setRealtimeOnline] = useState(true);
  const [newActivityCount, setNewActivityCount] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollAtTop = useRef(true);
  const existingIds = useRef(new Set<string>());
  const PAGE_SIZE = 30;

  /* Track scroll */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const atTop = el.scrollTop < 50;
      scrollAtTop.current = atTop;
      if (atTop) setNewActivityCount(0);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  /* Derive date range from preset */
  const dateRange = useMemo(() => {
    if (datePreset === null) return {};
    const preset = DATE_RANGE_PRESETS.find((p) => p.days === datePreset);
    return preset ? getDateRangeFromPreset(preset) : {};
  }, [datePreset]);

  /* Build query */
  const buildQuery = useCallback((p: number): ActivityLogQuery => ({
    page: p,
    pageSize: PAGE_SIZE,
    category: category === "all" ? undefined : category,
    actorRole: actorRole === "all" ? undefined : actorRole,
    search: search || undefined,
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
    priorityOnly: priorityOnly || undefined,
    campaignId: campaignIdFilter || undefined,
  }), [category, actorRole, search, dateRange, priorityOnly, campaignIdFilter]);

  /* Load data */
  const load = useCallback(() => {
    const result = queryActivityLogs(buildQuery(0));
    setEntries(result.entries);
    result.entries.forEach((e) => existingIds.current.add(e.id));
    setHasMore(result.hasMore);
    setTotal(result.total);
    setPage(0);
    setLoading(false);
  }, [buildQuery]);

  useEffect(() => { load(); }, [load]);

  /* Reset when filters change */
  useEffect(() => {
    setPage(0);
    setLoading(true);
    const timeout = setTimeout(() => load(), 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, actorRole, datePreset, priorityOnly, search, campaignIdFilter]);

  /* Load more */
  const loadMore = useCallback(() => {
    setLoadingMore(true);
    const nextPage = page + 1;
    const result = queryActivityLogs(buildQuery(nextPage));
    setEntries((prev) => [...prev, ...result.entries]);
    result.entries.forEach((e) => existingIds.current.add(e.id));
    setHasMore(result.hasMore);
    setTotal(result.total);
    setPage(nextPage);
    setLoadingMore(false);
  }, [page, buildQuery]);

  /* Realtime subscription */
  useEffect(() => {
    return subscribeToActivity((entry) => {
      if (existingIds.current.has(entry.id)) return;
      existingIds.current.add(entry.id);
      setEntries((prev) => [entry, ...prev]);
      setTotal((t) => t + 1);
      if (!scrollAtTop.current) {
        setNewActivityCount((c) => c + 1);
      }
    });
  }, []);

  /* Realtime connection status */
  useEffect(() => {
    setRealtimeOnline(getRealtimeStatus() === "connected");
    return onRealtimeStatusChange((s) => {
      setRealtimeOnline(s === "connected");
    });
  }, []);

  /* Group for timeline view */
  const grouped = useMemo(() => groupActivitiesByDate(entries), [entries]);

  /* Quick clear filters */
  const hasActiveFilters = category !== "all" || actorRole !== "all" || datePreset !== null ||
    priorityOnly || search !== "" || campaignIdFilter !== "";

  const clearFilters = () => {
    setCategory("all");
    setActorRole("all");
    setDatePreset(null);
    setPriorityOnly(false);
    setSearch("");
    setCampaignIdFilter("");
  };

  return (
    <div className="space-y-5">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold">Activity Log</h1>
            {loading ? (
              <div className="w-16 h-4 rounded bg-white/[0.04] shimmer" />
            ) : (
              <span className="text-[11px] text-zinc-500 font-mono tabular-nums bg-white/[0.04] px-2 py-0.5 rounded-full border border-white/[0.06]">
                {total} total
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-600 mt-1">Full audit trail of all campaign activity</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Realtime indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.06]">
            <span className={`w-1.5 h-1.5 rounded-full ${realtimeOnline ? "bg-emerald-500 live-dot" : "bg-amber-500"}`} />
            <span className={`text-[9px] font-medium ${realtimeOnline ? "text-emerald-400/80" : "text-amber-400/80"}`}>
              {realtimeOnline ? "LIVE" : "Reconnecting..."}
            </span>
          </div>
          {/* View toggle */}
          <div className="flex rounded-lg border border-white/[0.06] overflow-hidden">
            <button onClick={() => setView("timeline")}
              className={`px-2.5 py-1.5 text-[10px] font-medium transition-all ${
                view === "timeline" ? "bg-white/[0.08] text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <svg className="w-3.5 h-3.5 inline mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Timeline
            </button>
            <button onClick={() => setView("list")}
              className={`px-2.5 py-1.5 text-[10px] font-medium transition-all border-l border-white/[0.06] ${
                view === "list" ? "bg-white/[0.08] text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <svg className="w-3.5 h-3.5 inline mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              List
            </button>
          </div>
          <ExportDropdown entries={entries} />
        </div>
      </div>

      {/* ─── STATS BAR ─── */}
      {!loading && <StatsBar entries={entries} />}

      {/* ─── FILTERS ─── */}
      <div className="space-y-3">
        {/* Row 1 — Category pills */}
        <div className="flex gap-1 overflow-x-auto hide-scrollbar pb-1">
          {FILTER_TABS.map((f) => {
            const isActive = category === f.key;
            const meta = f.key !== "all" ? ACTIVITY_CATEGORIES[f.key] : null;
            return (
              <button key={f.key} onClick={() => setCategory(f.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all shrink-0 border ${
                  isActive
                    ? "bg-white/[0.08] text-white border-white/[0.12]"
                    : "text-zinc-500 hover:text-zinc-300 border-transparent hover:border-white/[0.06]"
                }`}
              >
                {meta && <span className="text-[11px]">{meta.icon}</span>}
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Row 2 — Actor role, date range, priority toggle, campaign ID */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Actor role */}
          <div className="flex gap-0.5 rounded-lg bg-white/[0.03] border border-white/[0.06] p-0.5">
            {ACTOR_FILTERS.map((af) => (
              <button key={af.key} onClick={() => setActorRole(af.key)}
                className={`px-2 py-1 rounded-md text-[9px] font-medium transition-all ${
                  actorRole === af.key ? "bg-white/[0.08] text-white" : "text-zinc-600 hover:text-zinc-400"
                }`}
              >
                {af.label}
              </button>
            ))}
          </div>

          {/* Date presets */}
          <div className="flex gap-0.5 rounded-lg bg-white/[0.03] border border-white/[0.06] p-0.5">
            {DATE_RANGE_PRESETS.map((dp) => (
              <button key={dp.label} onClick={() => setDatePreset(dp.days)}
                className={`px-2 py-1 rounded-md text-[9px] font-medium transition-all ${
                  datePreset === dp.days ? "bg-white/[0.08] text-white" : "text-zinc-600 hover:text-zinc-400"
                }`}
              >
                {dp.label}
              </button>
            ))}
          </div>

          {/* Priority toggle */}
          <button onClick={() => setPriorityOnly(!priorityOnly)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-medium transition-all ${
              priorityOnly
                ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                : "border-white/[0.06] text-zinc-600 hover:text-zinc-400"
            }`}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            Priority
            {priorityOnly && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
          </button>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button onClick={clearFilters}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04] transition-all"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear
            </button>
          )}
        </div>

        {/* Row 3 — Search & Campaign ID */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, description, actor, event type..."
              className="w-full bg-transparent border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-zinc-700 outline-none focus:border-red-500/50 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <div className="relative w-44">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
            </svg>
            <input type="text" value={campaignIdFilter} onChange={(e) => setCampaignIdFilter(e.target.value)}
              placeholder="Campaign ID..."
              className="w-full bg-transparent border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-zinc-700 outline-none focus:border-red-500/50 transition-colors font-mono"
            />
          </div>
        </div>
      </div>

      {/* ─── RESULTS ─── */}
      <div ref={scrollRef} className="relative max-h-[65vh] overflow-y-auto hide-scrollbar">
        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3 py-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="flex flex-col items-center pt-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
                  <div className="flex-1 w-px bg-zinc-800/50 min-h-[40px]" />
                </div>
                <div className="flex-1 space-y-2 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="h-3 w-32 rounded bg-zinc-800" />
                  <div className="h-2.5 w-48 rounded bg-zinc-800/70" />
                  <div className="flex gap-2">
                    <div className="h-4 w-14 rounded-full bg-zinc-800" />
                    <div className="h-4 w-16 rounded bg-zinc-800/50" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* New Activity indicator */}
        <AnimatePresence>
          {newActivityCount > 0 && (
            <motion.button
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              onClick={() => {
                scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                setNewActivityCount(0);
              }}
              className="sticky top-0 z-20 mx-auto mb-2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600/20 border border-red-500/30 text-red-400 text-[10px] font-medium backdrop-blur-xl shadow-lg shadow-red-500/5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {newActivityCount} new event{newActivityCount > 1 ? "s" : ""}
            </motion.button>
          )}
        </AnimatePresence>

        {!loading && entries.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="relative mb-4">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                <svg className="w-7 h-7 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-zinc-800 border-2 border-black" />
            </div>
            <p className="text-sm text-zinc-500 font-medium">No activity found</p>
            <p className="text-xs text-zinc-700 mt-1 text-center max-w-[240px]">
              {hasActiveFilters
                ? "Try adjusting your filters to see more results"
                : EMPTY_MESSAGES[category] || "Events will appear here as activity occurs"}
            </p>
            {hasActiveFilters && (
              <button onClick={clearFilters}
                className="mt-4 px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-all"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            {!loading && view === "timeline" && (
              /* ─── TIMELINE VIEW ─── */
              <div className="space-y-1">
                {grouped.map((group) => (
                  <div key={group.label} className="mb-5 last:mb-0">
                    <div className="flex items-center gap-2 mb-3 sticky top-0 bg-[#050505]/95 backdrop-blur z-10 py-1">
                      <div className="h-px flex-1 bg-white/[0.04]" />
                      <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider">{group.label}</span>
                      <span className="text-[9px] text-zinc-700 font-mono">({group.entries.length})</span>
                      <div className="h-px flex-1 bg-white/[0.04]" />
                    </div>
                    <div className="space-y-2">
                      {group.entries.map((entry) => (
                        <div key={entry.id} className="flex gap-3">
                          <div className="flex flex-col items-center pt-1.5">
                            <div className={`w-2.5 h-2.5 rounded-full ${ACTIVITY_CATEGORIES[entry.category].dot} ring-2 ring-black z-10`}
                              style={{ boxShadow: `0 0 8px ${ACTIVITY_CATEGORIES[entry.category].glow}` }} />
                            <div className="flex-1 w-px bg-gradient-to-b from-white/[0.06] to-transparent min-h-[8px]" />
                          </div>
                          <div className="flex-1 min-w-0 pb-2">
                            <ActivityCard entry={entry} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && view === "list" && (
              /* ─── LIST VIEW ─── */
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-left text-[9px] text-zinc-600 uppercase tracking-[0.08em]">
                      <th className="px-3 py-2.5 font-medium w-28">Time</th>
                      <th className="px-3 py-2.5 font-medium w-24">Campaign</th>
                      <th className="px-3 py-2.5 font-medium">Event</th>
                      <th className="px-3 py-2.5 font-medium hidden sm:table-cell">Description</th>
                      <th className="px-3 py-2.5 font-medium w-20">Actor</th>
                      <th className="px-3 py-2.5 font-medium w-16">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <ListRow key={entry.id} entry={entry} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {hasMore && (
              <div className="flex justify-center pt-4 pb-2">
                <button onClick={loadMore} disabled={loadingMore}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-[11px] text-zinc-500 hover:text-zinc-300 font-medium transition-all border border-white/[0.06] hover:border-white/[0.12] disabled:opacity-40"
                >
                  {loadingMore ? (
                    <div className="w-3 h-3 border-[1.5px] border-zinc-500/30 border-t-zinc-400 rounded-full animate-spin" />
                  ) : (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                  <span>Load more ({total - entries.length} remaining)</span>
                </button>
              </div>
            )}

            {/* Total count footer */}
            {total > 0 && (
              <div className="text-center py-3">
                <span className="text-[10px] text-zinc-700 font-mono">
                  Showing {entries.length} of {total} events
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getCampaignActivityLogPaginated, subscribeToActivity, groupActivitiesByDate,
  formatActivityTime, formatActivityTimestamp, actorDisplay,
  ACTIVITY_CATEGORIES, onRealtimeStatusChange, getRealtimeStatus,
  type ActivityEntry, type ActivityCategory,
} from "@/lib/activity-log";

type FilterMode = "all" | ActivityCategory;
type TabMode = "timeline" | "versions" | "comments";

const FILTERS: { key: FilterMode; label: string }[] = [
  { key: "all", label: "All" },
  { key: "approval", label: "Approvals" },
  { key: "revision", label: "Revisions" },
  { key: "payment", label: "Payments" },
  { key: "scheduling", label: "Scheduling" },
  { key: "posting", label: "Posting" },
  { key: "comment", label: "Comments" },
  { key: "assignment", label: "Assignments" },
  { key: "ai", label: "AI" },
];

const EMPTY_MESSAGES: Record<string, string> = {
  all: "Events will appear here as the campaign progresses",
  approval: "No approvals recorded yet",
  revision: "No revisions requested yet",
  payment: "No payment events yet",
  scheduling: "No scheduling events yet",
  posting: "No posting events yet",
  comment: "No comments yet",
  assignment: "No assignment events yet",
  ai: "No AI alerts yet",
};

const PRIORITY_TYPES = new Set([
  "revision_requested", "artist_revision_requested", "payment_rejected",
  "status_override", "ai_alert",
]);

const PAGE_SIZE = 25;

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

/* ─── TIMESTAMP FORMAT ───────────────────────────────────── */

function compactTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  const hours = d.getHours().toString().padStart(2, "0");
  const mins = d.getMinutes().toString().padStart(2, "0");
  const time = `${hours}:${mins}`;

  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `Today at ${time}`;
  if (days === 1) return `Yesterday at ${time}`;
  if (days < 7) return `${days}d ago at ${time}`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + ` at ${time}`;
}

/* ─── ACTIVITY CARD ──────────────────────────────────────── */

function ActivityCard({ entry }: { entry: ActivityEntry }) {
  const meta = ACTIVITY_CATEGORIES[entry.category];
  const accentColor = meta.glow.replace("0.4)", "1)");
  const isPriority = PRIORITY_TYPES.has(entry.type);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="rounded-xl border backdrop-blur-xl p-3 relative overflow-hidden"
      style={{
        borderColor: isPriority ? meta.glow.replace("0.4)", "0.3)") : `${meta.glow.replace("0.4)", "0.15)")}`,
        backgroundColor: isPriority ? `${meta.glow.replace("0.4)", "0.06)")}` : `${meta.glow.replace("0.4)", "0.03)")}`,
        boxShadow: isPriority ? `0 0 12px ${meta.glow.replace("0.4)", "0.08)")}` : "none",
      }}
    >
      {/* Left accent bar */}
      <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
        style={{ background: `linear-gradient(to bottom, ${accentColor}, transparent)` }}
      />
      <div className="flex items-start gap-3 pl-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 ${meta.bg}`}>
          {meta.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-white/90">{entry.title}</span>
            <span className="text-[10px] text-zinc-600 font-mono tracking-tight">{compactTimestamp(entry.timestamp)}</span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed line-clamp-2">{entry.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full border ${roleBadgeColor(entry.actorRole)}`}>
              {actorDisplay(entry.actor, entry.actorRole)}
            </span>
            {isPriority && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                {entry.type === "revision_requested" || entry.type === "artist_revision_requested" ? "Changes" : "Alert"}
              </span>
            )}
            {entry.version && (
              <span className="text-[9px] font-mono text-zinc-600 bg-white/[0.04] px-1.5 py-0.5 rounded">v{entry.version}</span>
            )}
            {entry.metadata?.url && (
              <span className="text-[9px] text-zinc-700 truncate max-w-[120px] hidden sm:inline" title={entry.metadata.url}>
                {entry.metadata.url.replace("https://www.tiktok.com/", "tiktok/")}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── VERSION ROW ─────────────────────────────────────────── */

function VersionRow({ entry }: { entry: ActivityEntry }) {
  const meta = ACTIVITY_CATEGORIES[entry.category];
  const isApproved = entry.type === "artist_approved" || entry.type === "admin_approved";
  const isRevision = entry.type === "revision_requested" || entry.type === "editor_submitted" || entry.type === "version_uploaded";
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 ${
        isApproved ? "bg-emerald-500/20 text-emerald-400" : isRevision ? "bg-amber-500/20 text-amber-400" : meta.bg
      }`}>
        {isApproved ? "✅" : isRevision ? "🔄" : meta.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white">{entry.title}</span>
          {entry.version && (
            <span className="text-[10px] font-mono text-zinc-500 bg-white/[0.04] px-1.5 py-0.5 rounded">v{entry.version}</span>
          )}
        </div>
        <p className="text-[10px] text-zinc-500 truncate">{entry.description}</p>
        <p className="text-[9px] text-zinc-700 mt-0.5">
          {actorDisplay(entry.actor, entry.actorRole)} · {formatActivityTimestamp(entry.timestamp)}
        </p>
      </div>
    </div>
  );
}

/* ─── COMMENT CARD ────────────────────────────────────────── */

function CommentCard({ entry }: { entry: ActivityEntry }) {
  return (
    <div className="flex gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
      <div className="w-7 h-7 rounded-lg bg-pink-500/20 flex items-center justify-center text-xs shrink-0">
        {entry.actorRole === "artist" ? "🎨" : entry.actorRole === "admin" ? "👤" : "✏️"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-white">{actorDisplay(entry.actor, entry.actorRole)}</span>
          <span className="text-[9px] text-zinc-600">{formatActivityTime(entry.timestamp)}</span>
        </div>
        <p className="text-[11px] text-zinc-400 mt-0.5">{entry.description}</p>
        <p className="text-[9px] text-zinc-700 mt-1">{formatActivityTimestamp(entry.timestamp)}</p>
      </div>
    </div>
  );
}

/* ─── TIMELINE ────────────────────────────────────────────── */

interface ActivityTimelineProps {
  campaignId: string;
  maxHeight?: string;
  compact?: boolean;
  showTabs?: boolean;
}

export default function ActivityTimeline({
  campaignId, maxHeight, compact, showTabs = true,
}: ActivityTimelineProps) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [tab, setTab] = useState<TabMode>("timeline");
  const [versions, setVersions] = useState<ActivityEntry[]>([]);
  const [comments, setComments] = useState<ActivityEntry[]>([]);
  const [newActivityCount, setNewActivityCount] = useState(0);
  const [realtimeOnline, setRealtimeOnline] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollAtTop = useRef(true);
  const existingIds = useRef(new Set<string>());

  // Track scroll position
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

  // Load initial entries
  const load = useCallback(() => {
    const result = getCampaignActivityLogPaginated(campaignId, 0, PAGE_SIZE);
    setEntries(result.entries);
    result.entries.forEach((e) => existingIds.current.add(e.id));
    setHasMore(result.hasMore);
    setPage(0);
    setLoading(false);

    // Load version history entries
    const all = getCampaignActivityLogPaginated(campaignId, 0, 500);
    const vers = all.entries.filter((e) =>
      e.category === "revision" || e.category === "approval"
    );
    setVersions(vers);

    // Load comment entries
    const cmts = all.entries.filter((e) => e.category === "comment");
    setComments(cmts);
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  // Load more (pagination)
  const loadMore = useCallback(() => {
    setLoadingMore(true);
    const nextPage = page + 1;
    const result = getCampaignActivityLogPaginated(campaignId, nextPage, PAGE_SIZE);
    setEntries((prev) => [...prev, ...result.entries]);
    result.entries.forEach((e) => existingIds.current.add(e.id));
    setHasMore(result.hasMore);
    setPage(nextPage);
    setLoadingMore(false);
  }, [campaignId, page]);

  // Realtime subscription (CustomEvent + Supabase) with dedup
  useEffect(() => {
    return subscribeToActivity((entry) => {
      if (entry.campaignId !== campaignId) return;
      // Dedup: skip if we already have this ID
      if (existingIds.current.has(entry.id)) return;
      existingIds.current.add(entry.id);

      setEntries((prev) => [entry, ...prev]);
      if (entry.category === "revision" || entry.category === "approval") {
        setVersions((prev) => [entry, ...prev]);
      }
      if (entry.category === "comment") {
        setComments((prev) => [entry, ...prev]);
      }
      // Track new activity when scrolled away
      if (!scrollAtTop.current) {
        setNewActivityCount((c) => c + 1);
      }
    });
  }, [campaignId]);

  // Connection status subscription
  useEffect(() => {
    setRealtimeOnline(getRealtimeStatus() === "connected");
    return onRealtimeStatusChange((s) => {
      setRealtimeOnline(s === "connected");
    });
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const filtered = useMemo(() => {
    let result = filter === "all" ? entries : entries.filter((e) => e.category === filter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((e) =>
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.actor.toLowerCase().includes(q) ||
        e.type.toLowerCase().includes(q) ||
        Object.values(e.metadata).some((v) => v.toLowerCase().includes(q))
      );
    }
    return result;
  }, [entries, filter, searchQuery]);

  const grouped = useMemo(() => groupActivitiesByDate(filtered), [filtered]);

  // Timeline summary
  const summary = useMemo(() => {
    if (entries.length === 0) return null;
    const revisionCount = entries.filter((e) => e.category === "revision").length;
    const approvalCount = entries.filter((e) => e.category === "approval").length;
    const paymentCount = entries.filter((e) => e.category === "payment").length;
    const completed = entries.find((e) => e.type === "campaign_completed");
    const created = entries.find((e) => e.type === "campaign_created");
    const days = completed && created
      ? Math.round((new Date(completed.timestamp).getTime() - new Date(created.timestamp).getTime()) / 86400000)
      : null;
    const parts: string[] = [];
    if (revisionCount > 0) parts.push(`${revisionCount} revision${revisionCount > 1 ? "s" : ""}`);
    if (approvalCount > 0) parts.push(`${approvalCount} approval${approvalCount > 1 ? "s" : ""}`);
    if (paymentCount > 0) parts.push(`${paymentCount} payment${paymentCount > 1 ? "s" : ""}`);
    if (days !== null) parts.push(`completed in ${days}d`);
    return parts.length > 0 ? parts.join(" · ") : null;
  }, [entries]);

  // Aggregate version timeline from submissions
  const versionTimeline = useMemo(() => versions, [versions]);

  // Aggregate comment entries
  const commentEntries = useMemo(() => {
    return comments;
  }, [comments]);

  if (loading) {
    return (
      <div className="space-y-3 py-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="flex flex-col items-center pt-1">
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
              <div className="flex-1 w-px bg-zinc-800/50 min-h-[40px]" />
            </div>
            <div className="flex-1 space-y-2 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="h-3 w-28 rounded bg-zinc-800" />
              <div className="h-2.5 w-44 rounded bg-zinc-800/70" />
              <div className="flex gap-2">
                <div className="h-4 w-14 rounded-full bg-zinc-800" />
                <div className="h-4 w-10 rounded bg-zinc-800/50" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ─── SUB-TABS ─── */}
      {showTabs && (
        <div className="flex gap-1 rounded-lg bg-white/[0.03] p-0.5 border border-white/[0.06]">
          {([
            { key: "timeline" as TabMode, label: "Timeline" },
            { key: "versions" as TabMode, label: `Versions (${versionTimeline.length})` },
            { key: "comments" as TabMode, label: `Comments (${commentEntries.length})` },
          ]).map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-1.5 rounded-md text-[10px] font-medium transition-all ${
                tab === t.key ? "bg-white/[0.08] text-white" : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ─── TIMELINE TAB ─── */}
      {tab === "timeline" && (
        <>
          {/* Summary header */}
          {summary && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <svg className="w-3 h-3 text-zinc-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="text-[10px] text-zinc-500 font-medium">{summary}</span>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events..." spellCheck={false}
              className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px] text-zinc-300 placeholder-zinc-700 outline-none focus:border-white/[0.12] transition-colors"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex gap-1 overflow-x-auto hide-scrollbar pb-1">
            {FILTERS.map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all shrink-0 ${
                  filter === f.key
                    ? "bg-white/[0.08] text-white"
                    : "text-zinc-600 hover:text-zinc-400"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Timeline list */}
          <div ref={scrollRef} className={`relative ${maxHeight ? `overflow-y-auto ${maxHeight} hide-scrollbar` : ""}`}>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="relative mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                    <svg className="w-6 h-6 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-zinc-800 border-2 border-black" />
                </div>
                <p className="text-sm text-zinc-500 font-medium">No activity yet</p>
                <p className="text-xs text-zinc-700 mt-1 text-center max-w-[200px]">
                  {searchQuery ? "No matching events" : EMPTY_MESSAGES[filter] || "No events yet"}
                </p>
              </div>
            ) : (
              <>
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
              {!realtimeOnline && (
                <div className="flex items-center justify-center gap-1.5 px-2 py-1 mb-1">
                  <span className="w-1 h-1 rounded-full bg-amber-500" />
                  <span className="text-[9px] text-amber-600/60 font-medium">Reconnecting...</span>
                </div>
              )}
              <AnimatePresence mode="popLayout">
                {grouped.map((group) => {
                  const isCollapsed = collapsedGroups.has(group.label);
                  return (
                  <div key={group.label} className="mb-4 last:mb-0">
                    <button onClick={() => toggleGroup(group.label)}
                      className="flex items-center gap-2 mb-2 w-full sticky top-0 bg-[#050505]/95 backdrop-blur z-10 py-1 group"
                    >
                      <div className="h-px flex-1 bg-white/[0.04]" />
                      <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider">{group.label}</span>
                      <svg className={`w-2.5 h-2.5 text-zinc-700 transition-transform ${isCollapsed ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      <div className="h-px flex-1 bg-white/[0.04]" />
                    </button>
                    {!isCollapsed && (
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
                    )}
                  </div>
                );
                })}
              </AnimatePresence>
            </>
            )}

            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center pt-2 pb-1">
                <button onClick={loadMore} disabled={loadingMore}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-[11px] text-zinc-500 hover:text-zinc-300 font-medium transition-all border border-white/[0.06] hover:border-white/[0.12] disabled:opacity-40"
                >
                  {loadingMore ? (
                    <div className="w-3 h-3 border-[1.5px] border-zinc-500/30 border-t-zinc-400 rounded-full animate-spin" />
                  ) : (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                  <span>Load more</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── VERSIONS TAB ─── */}
      {tab === "versions" && (
        <div className={maxHeight ? `overflow-y-auto ${maxHeight} hide-scrollbar` : ""}>
          {versionTimeline.length === 0 ? (
            <div className="flex flex-col items-center py-10">
              <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <p className="text-xs text-zinc-600">No version history yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {versionTimeline.map((entry) => (
                <VersionRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── COMMENTS TAB ─── */}
      {tab === "comments" && (
        <div className={maxHeight ? `overflow-y-auto ${maxHeight} hide-scrollbar` : ""}>
          {commentEntries.length === 0 ? (
            <div className="flex flex-col items-center py-10">
              <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-xs text-zinc-600">No comments yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {commentEntries.map((entry) => (
                <CommentCard key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

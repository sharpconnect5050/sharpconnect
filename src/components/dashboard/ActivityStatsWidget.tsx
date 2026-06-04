"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { getRecentActivityLog, subscribeToActivity, computeActivityStats, ACTIVITY_CATEGORIES, type ActivityCategory, type ActorType } from "@/lib/activity-log";

interface StatItem {
  label: string;
  value: string;
  icon: string;
  color: string;
  glow: string;
}

const ACTOR_LABELS: Record<ActorType, string> = {
  admin: "Admin", artist: "Artist", editor: "Editor", ai: "AI", system: "System",
};

export default function ActivityStatsWidget() {
  const [entries, setEntries] = useState(getRecentActivityLog(200));

  useEffect(() => {
    const unsub = subscribeToActivity(() => {
      setEntries(getRecentActivityLog(200));
    });
    const interval = setInterval(() => setEntries(getRecentActivityLog(200)), 5000);
    return () => { unsub(); clearInterval(interval); };
  }, []);

  const stats = useMemo(() => computeActivityStats(entries), [entries]);

  const todayCount = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return entries.filter((e) => e.timestamp.startsWith(today)).length;
  }, [entries]);

  const topCategory = useMemo(() => {
    let max = 0;
    let top: ActivityCategory | null = null;
    for (const [cat, count] of Object.entries(stats.byCategory)) {
      if (count > max) { max = count; top = cat as ActivityCategory; }
    }
    return top ? { category: top, count: max, meta: ACTIVITY_CATEGORIES[top] } : null;
  }, [stats.byCategory]);

  const items: StatItem[] = [
    {
      label: "Total Events",
      value: String(stats.total),
      icon: "📊",
      color: "text-blue-400",
      glow: "rgba(59,130,246,0.4)",
    },
    {
      label: "Today",
      value: String(todayCount),
      icon: "📅",
      color: "text-emerald-400",
      glow: "rgba(34,197,94,0.4)",
    },
    {
      label: "Campaigns",
      value: String(stats.uniqueCampaigns),
      icon: "🎯",
      color: "text-purple-400",
      glow: "rgba(168,85,247,0.4)",
    },
    {
      label: "Priority",
      value: String(stats.priorityCount),
      icon: "⚡",
      color: "text-red-400",
      glow: "rgba(239,68,68,0.4)",
    },
  ];

  const actorItems = (Object.entries(stats.byActorRole) as [ActorType, number][])
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a);

  return (
    <div className="glass-card-premium p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(251,191,36,0.5)]" />
        <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-[0.08em]">Activity Stats</h3>
      </div>

      {/* Main stats grid */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {items.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[16px]">{item.icon}</span>
              <span className={`text-xs font-bold tabular-nums ${item.color}`}>{item.value}</span>
            </div>
            <p className="text-[9px] text-zinc-600 font-medium">{item.label}</p>
            <div className="mt-1.5 h-0.5 rounded-full bg-white/[0.04] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((stats.total > 0 ? parseInt(item.value) / stats.total : 0) * 100, 100)}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ background: item.glow, opacity: 0.6 }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Top category */}
      {topCategory && (
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.04] mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">{topCategory.meta.icon}</span>
              <div>
                <p className="text-[10px] text-zinc-500 font-medium">Top category</p>
                <p className="text-xs font-semibold text-zinc-300">{topCategory.meta.label}</p>
              </div>
            </div>
            <span className="text-sm font-bold tabular-nums text-zinc-300">{topCategory.count}</span>
          </div>
        </div>
      )}

      {/* By actor role */}
      {actorItems.length > 0 && (
        <div>
          <p className="text-[9px] text-zinc-700 font-medium uppercase tracking-wider mb-2">By actor</p>
          <div className="space-y-1.5">
            {actorItems.map(([role, count]) => {
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              return (
                <div key={role} className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500 w-12 shrink-0">{ACTOR_LABELS[role]}</span>
                  <div className="flex-1 h-1 rounded-full bg-white/[0.04] overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{
                        background: role === "admin" ? "rgba(59,130,246,0.5)" :
                          role === "artist" ? "rgba(34,197,94,0.5)" :
                          role === "editor" ? "rgba(245,158,11,0.5)" :
                          role === "ai" ? "rgba(168,85,247,0.5)" :
                          "rgba(113,113,122,0.5)",
                      }}
                    />
                  </div>
                  <span className="text-[9px] font-mono tabular-nums text-zinc-600 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

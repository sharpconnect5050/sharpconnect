"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { getRecentActivityLog, subscribeToActivity, computeActivityStats, ACTIVITY_CATEGORIES, type ActivityCategory } from "@/lib/activity-log";

const CATEGORY_ORDER: ActivityCategory[] = ["approval", "revision", "payment", "assignment", "scheduling", "posting", "ai", "comment", "system"];
const CATEGORY_ICONS: Record<ActivityCategory, string> = {
  approval: "✅", revision: "🔄", payment: "💳", assignment: "👤",
  scheduling: "📅", posting: "🔥", ai: "🤖", comment: "💬", system: "⚙️",
};

function CategoryBar({ category, count, max }: { category: ActivityCategory; count: number; max: number }) {
  const meta = ACTIVITY_CATEGORIES[category];
  const pct = max > 0 ? (count / max) * 100 : 0;

  return (
    <div className="flex items-center gap-2.5 group">
      <div className="w-5 text-center shrink-0 text-xs">{CATEGORY_ICONS[category]}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-medium text-zinc-400 group-hover:text-zinc-300 transition-colors">{meta.label}</span>
          <span className="text-[9px] font-mono tabular-nums text-zinc-600">{count}</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="h-full rounded-full"
            style={{ background: meta.glow, opacity: 0.7 }}
          />
        </div>
      </div>
    </div>
  );
}

export default function ActivityVolumeWidget() {
  const [entries, setEntries] = useState(getRecentActivityLog(200));
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const unsub = subscribeToActivity(() => {
      setEntries(getRecentActivityLog(200));
    });
    const interval = setInterval(() => setEntries(getRecentActivityLog(200)), 5000);
    return () => { unsub(); clearInterval(interval); };
  }, []);

  const stats = useMemo(() => computeActivityStats(entries), [entries]);
  const maxCount = Math.max(...Object.values(stats.byCategory), 1);

  const categories = useMemo(() => {
    const cats = CATEGORY_ORDER
      .map((c) => ({ category: c, count: stats.byCategory[c] }))
      .filter((c) => showAll || c.count > 0);
    return showAll ? cats : cats.slice(0, 6);
  }, [stats.byCategory, showAll]);

  const total = stats.total;
  const hasMoreHidden = !showAll && CATEGORY_ORDER.some((c) => stats.byCategory[c] > 0 && !categories.find((x) => x.category === c));

  return (
    <div className="glass-card-premium p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_6px_rgba(168,85,247,0.5)]" />
          <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-[0.08em]">Activity Volume</h3>
        </div>
        <span className="text-[9px] font-mono tabular-nums text-zinc-600">
          {total} event{total !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-2.5">
        {categories.map(({ category, count }) => (
          <CategoryBar key={category} category={category} count={count} max={maxCount} />
        ))}
      </div>

      {hasMoreHidden && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-3 w-full text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors font-medium text-center py-1"
        >
          Show all categories
        </button>
      )}
      {showAll && (
        <button
          onClick={() => setShowAll(false)}
          className="mt-3 w-full text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors font-medium text-center py-1"
        >
          Show less
        </button>
      )}
    </div>
  );
}

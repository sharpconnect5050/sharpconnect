"use client";

import { motion } from "framer-motion";

interface MetricDef {
  id: string;
  label: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  icon: string;
  glowColor: string;
  pulseColor: string;
}

export default function CommandCenterMetrics({ items, loading }: { items: MetricDef[]; loading?: boolean }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
      {items.map((m, i) => (
        <MetricCard key={m.id} metric={m} index={i} loading={loading} />
      ))}
    </div>
  );
}

function MetricCard({ metric, index, loading }: { metric: MetricDef; index: number; loading?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="relative group glass-card-premium p-4 overflow-hidden command-glow"
    >
      {/* Top accent glow */}
      <div
        className="absolute top-0 left-0 right-0 h-px opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${metric.glowColor}, transparent)` }}
      />

      {/* Hover shine */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${metric.glowColor}08, transparent 60%)` }}
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-[0.08em]">
            {metric.label}
          </span>
          <span className="text-sm">{metric.icon}</span>
        </div>

        {loading ? (
          <div className="shimmer h-7 w-24 rounded-lg" />
        ) : (
          <div className="flex items-end gap-2">
            <span
              className="text-xl sm:text-2xl font-bold tracking-tight animate-count-up"
              style={{ color: metric.glowColor }}
            >
              {metric.value}
            </span>
            {metric.trend && (
              <span className={`text-[10px] font-medium mb-0.5 ${metric.trendUp ? "text-emerald-400" : "text-red-400"}`}>
                {metric.trendUp ? "↑" : "↓"} {metric.trend}
              </span>
            )}
          </div>
        )}

        {/* Live pulse dot */}
        <div className="flex items-center gap-1.5 mt-2">
          <span
            className="w-1 h-1 rounded-full"
            style={{ background: metric.pulseColor, boxShadow: `0 0 4px ${metric.pulseColor}` }}
          />
          <span className="text-[9px] text-zinc-600">realtime</span>
        </div>
      </div>
    </motion.div>
  );
}

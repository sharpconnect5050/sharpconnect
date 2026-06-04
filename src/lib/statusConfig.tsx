import { motion } from "framer-motion";

export type CampaignStatus =
  | "Pending Verification" | "Paid" | "Assigned" | "Editing"
  | "Pending Admin Review" | "Needs Revision" | "Approved"
  | "Pending Artist Review" | "Artist Revision Requested" | "Approved By Artist"
  | "Ready To Schedule" | "Template Created" | "Scheduled" | "Posted"
  | "Completed" | "Rejected";

export type Priority = "Low" | "Medium" | "High" | "Urgent";

export interface StatusMeta {
  label: string;
  shortLabel: string;
  icon: string;
  /** tailwind classes for the status badge */
  badge: string;
  /** tailwind classes for dot indicator */
  dot: string;
  /** css color for glow effects */
  glow: string;
  /** group order for sorting */
  group: number;
}

const BASE_BADGE = "px-2 py-0.5 rounded-full text-[10px] font-medium border";

export const STATUS_META: Record<CampaignStatus, StatusMeta> = {
  "Pending Verification": {
    label: "Pending Verification", shortLabel: "Pending",
    icon: "⏳",
    badge: `${BASE_BADGE} bg-amber-500/15 text-amber-400 border-amber-500/25`,
    dot: "bg-amber-500 shadow-[0_0_6px_rgba(251,191,36,0.5)]",
    glow: "#f59e0b",
    group: 0,
  },
  Paid: {
    label: "Paid", shortLabel: "Paid",
    icon: "✅",
    badge: `${BASE_BADGE} bg-emerald-500/15 text-emerald-400 border-emerald-500/25`,
    dot: "bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]",
    glow: "#22c55e",
    group: 0,
  },
  Assigned: {
    label: "Assigned", shortLabel: "Assigned",
    icon: "👤",
    badge: `${BASE_BADGE} bg-orange-500/15 text-orange-400 border-orange-500/25`,
    dot: "bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.5)]",
    glow: "#f97316",
    group: 1,
  },
  Editing: {
    label: "Editing", shortLabel: "Editing",
    icon: "🎬",
    badge: `${BASE_BADGE} bg-cyan-500/15 text-cyan-400 border-cyan-500/25 animate-pulse-cyan`,
    dot: "bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.5)] animate-pulse-cyan",
    glow: "#06b6d4",
    group: 1,
  },
  "Pending Admin Review": {
    label: "Pending Admin Review", shortLabel: "Review",
    icon: "🔍",
    badge: `${BASE_BADGE} bg-purple-500/15 text-purple-400 border-purple-500/25 animate-pulse-purple`,
    dot: "bg-purple-500 shadow-[0_0_6px_rgba(168,85,247,0.5)] animate-pulse-purple",
    glow: "#a855f7",
    group: 1,
  },
  "Needs Revision": {
    label: "Needs Revision", shortLabel: "Revise",
    icon: "🔄",
    badge: `${BASE_BADGE} bg-rose-500/15 text-rose-400 border-rose-500/25`,
    dot: "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]",
    glow: "#f43f5e",
    group: 1,
  },
  Approved: {
    label: "Approved", shortLabel: "Approved",
    icon: "👍",
    badge: `${BASE_BADGE} bg-emerald-500/15 text-emerald-400 border-emerald-500/25`,
    dot: "bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]",
    glow: "#22c55e",
    group: 1,
  },
  "Pending Artist Review": {
    label: "Pending Artist Review", shortLabel: "Artist Review",
    icon: "👁️",
    badge: `${BASE_BADGE} bg-pink-500/15 text-pink-400 border-pink-500/25`,
    dot: "bg-pink-500 shadow-[0_0_6px_rgba(236,72,153,0.5)]",
    glow: "#ec4899",
    group: 1,
  },
  "Artist Revision Requested": {
    label: "Artist Revision Requested", shortLabel: "Artist Revise",
    icon: "🔄",
    badge: `${BASE_BADGE} bg-amber-500/15 text-amber-400 border-amber-500/25`,
    dot: "bg-amber-500 shadow-[0_0_6px_rgba(251,191,36,0.5)]",
    glow: "#f59e0b",
    group: 1,
  },
  "Approved By Artist": {
    label: "Approved By Artist", shortLabel: "Artist OK",
    icon: "✅",
    badge: `${BASE_BADGE} bg-teal-500/15 text-teal-400 border-teal-500/25`,
    dot: "bg-teal-500 shadow-[0_0_6px_rgba(20,184,166,0.5)]",
    glow: "#14b8a6",
    group: 2,
  },
  "Ready To Schedule": {
    label: "Ready To Schedule", shortLabel: "Ready",
    icon: "📅",
    badge: `${BASE_BADGE} bg-sky-500/15 text-sky-400 border-sky-500/25 animate-pulse-cyan`,
    dot: "bg-sky-500 shadow-[0_0_6px_rgba(14,165,233,0.5)] animate-pulse-cyan",
    glow: "#0ea5e9",
    group: 2,
  },
  "Template Created": {
    label: "Template Created", shortLabel: "Template",
    icon: "📄",
    badge: `${BASE_BADGE} bg-cyan-500/15 text-cyan-400 border-cyan-500/25`,
    dot: "bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.5)]",
    glow: "#06b6d4",
    group: 2,
  },
  Scheduled: {
    label: "Scheduled", shortLabel: "Scheduled",
    icon: "📆",
    badge: `${BASE_BADGE} bg-indigo-500/15 text-indigo-400 border-indigo-500/25`,
    dot: "bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.5)]",
    glow: "#6366f1",
    group: 2,
  },
  Posted: {
    label: "Posted", shortLabel: "Posted",
    icon: "📤",
    badge: `${BASE_BADGE} bg-violet-500/15 text-violet-400 border-violet-500/25 animate-pulse-green`,
    dot: "bg-violet-500 shadow-[0_0_6px_rgba(139,92,246,0.5)]",
    glow: "#8b5cf6",
    group: 3,
  },
  Completed: {
    label: "Completed", shortLabel: "Complete",
    icon: "🎉",
    badge: `${BASE_BADGE} bg-emerald-500/15 text-emerald-400 border-emerald-500/25`,
    dot: "bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.5)] animate-pulse-green",
    glow: "#22c55e",
    group: 3,
  },
  Rejected: {
    label: "Rejected", shortLabel: "Rejected",
    icon: "❌",
    badge: `${BASE_BADGE} bg-red-500/15 text-red-400 border-red-500/25`,
    dot: "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]",
    glow: "#ef4444",
    group: 4,
  },
};

export const PRIORITY_META: Record<Priority, { badge: string; dot: string; glow: string }> = {
  Low: {
    badge: "px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-500/10 text-zinc-400",
    dot: "bg-zinc-500", glow: "#71717a",
  },
  Medium: {
    badge: "px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400",
    dot: "bg-blue-500", glow: "#3b82f6",
  },
  High: {
    badge: "px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-500/10 text-orange-400",
    dot: "bg-orange-500", glow: "#f97316",
  },
  Urgent: {
    badge: "px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-400 animate-pulse-urgent",
    dot: "bg-red-500 animate-pulse-urgent", glow: "#ef4444",
  },
};

export const STATUS_GROUPS: { label: string; statuses: CampaignStatus[] }[] = [
  { label: "Payment", statuses: ["Pending Verification", "Paid"] },
  { label: "Production", statuses: ["Assigned", "Editing", "Pending Admin Review", "Needs Revision", "Approved", "Pending Artist Review", "Artist Revision Requested", "Approved By Artist", "Ready To Schedule", "Template Created"] },
  { label: "Delivery", statuses: ["Scheduled", "Posted", "Completed"] },
  { label: "Void", statuses: ["Rejected"] },
];

export function StatusBadge({ status }: { status: CampaignStatus }) {
  const m = STATUS_META[status];
  if (!m) return <span className={`${BASE_BADGE} bg-zinc-500/10 text-zinc-400 border-zinc-500/20`}>{status}</span>;
  return <span className={m.badge}>{m.shortLabel}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const m = PRIORITY_META[priority];
  if (!m) return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-500/10 text-zinc-400">{priority}</span>;
  return <span className={m.badge}>{priority}</span>;
}

export function StatusDot({ status, className = "" }: { status: CampaignStatus; className?: string }) {
  const m = STATUS_META[status];
  return <span className={`w-2 h-2 rounded-full shrink-0 ${m?.dot || "bg-zinc-500"} ${className}`} />;
}

export function ProgressBar({ status, className = "" }: { status: CampaignStatus; className?: string }) {
  const m = STATUS_META[status];
  const groupOrder = [0, 1, 2, 3, 4];
  const pct = status ? Math.round((Math.min(STATUS_GROUPS.flatMap(g => g.statuses).indexOf(status) + 1) / 16) * 100) : 0;
  const color = m?.glow || "#ef4444";

  return (
    <div className={`h-1 rounded-full bg-white/[0.06] overflow-hidden ${className}`}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="h-full rounded-full"
        style={{ background: `linear-gradient(90deg, ${color}, ${color}88)`, boxShadow: `0 0 8px ${color}44` }}
      />
    </div>
  );
}

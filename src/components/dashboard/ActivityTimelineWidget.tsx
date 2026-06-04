"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getFilteredNotifications, onNotify,
  getNotificationGroup, getNotificationGroupColor, GROUP_META,
  getPriorityBorder, type AppNotification, type NotificationGroup,
} from "@/lib/notifications";

/* ─── CONSTANTS ──────────────────────────────────────────── */

const NOTIF_ICONS: Record<string, string> = {
  new_campaign: "🎵", payment_uploaded: "💰", payment_approved: "✅",
  payment_rejected: "❌", editor_assigned: "👤", editor_submitted: "🎬",
  revision_requested: "🔄", admin_approved: "✅", campaign_scheduled: "📅",
  post_submitted: "🔗", post_verified: "✅", overdue_campaign: "⏰",
  campaign_completed: "🎉", support_request: "💬", ai_alert: "🤖",
  artist_review_ready: "🎨", artist_approved: "👍",
  artist_revision_requested: "🔄",
};

/* ─── RELATIVE TIME ──────────────────────────────────────── */

function formatRelTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/* ─── ENTRY ──────────────────────────────────────────────── */

function TimelineEntry({ n, index }: { n: AppNotification; index: number }) {
  const group = getNotificationGroup(n);
  const groupMeta = GROUP_META[group];
  const time = formatRelTime(n.createdAt);
  const icon = NOTIF_ICONS[n.type] || groupMeta.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
      className={`flex items-start gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors border-b border-white/[0.02] last:border-0 group ${
        !n.read ? "bg-white/[0.015]" : ""
      }`}
    >
      {/* Timeline dot + line */}
      <div className="flex flex-col items-center shrink-0 pt-1">
        <div className={`w-2 h-2 rounded-full ${n.priority === "urgent" ? "bg-red-500 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.5)]" : getNotificationGroupColor(group).split(" ")[0]}`} />
        <div className="w-px flex-1 bg-white/[0.04] min-h-[20px] mt-1" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs shrink-0">{icon}</span>
          <p className={`text-[11px] font-medium truncate transition-colors ${
            n.read ? "text-zinc-500" : "text-zinc-200"
          }`}>
            {n.title}
          </p>
          <span className="text-[9px] text-zinc-700 font-mono ml-auto shrink-0">{time}</span>
        </div>
        <p className={`text-[10px] mt-0.5 line-clamp-1 ${
          n.read ? "text-zinc-600" : "text-zinc-400"
        }`}>
          {n.message}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {n.triggeredBy && (
            <span className="text-[8px] text-zinc-700 font-medium">{n.triggeredBy}</span>
          )}
          {n.campaignId && (
            <span className="text-[7px] text-zinc-800 font-mono">{n.campaignId}</span>
          )}
          <span className={`text-[7px] px-1 py-0.5 rounded-full ${getNotificationGroupColor(group)}`}>
            {groupMeta.label}
          </span>
          {n.priority === "urgent" && (
            <span className="text-[7px] px-1 py-0.5 rounded-full bg-red-500/10 text-red-400 font-semibold">URGENT</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── WIDGET ─────────────────────────────────────────────── */

export default function ActivityTimelineWidget() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [limit, setLimit] = useState(8);

  const refresh = useMemo(() => () => {
    setNotifications(getFilteredNotifications().slice(0, 50));
  }, []);

  useEffect(() => {
    refresh();
    const unsub = onNotify(refresh);
    const interval = setInterval(refresh, 5000);
    return () => { unsub(); clearInterval(interval); };
  }, [refresh]);

  const visible = useMemo(() => notifications.slice(0, limit), [notifications, limit]);
  const hasMore = notifications.length > limit;
  const urgentCount = useMemo(() => notifications.filter((n) => !n.read && n.priority === "urgent").length, [notifications]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  return (
    <div className="glass-card-premium overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className={`w-2 h-2 rounded-full ${urgentCount > 0 ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`}
            style={urgentCount > 0 ? { boxShadow: "0 0 6px rgba(239,68,68,0.5)" } : { boxShadow: "0 0 6px rgba(34,197,94,0.5)" }}
          />
          <h3 className="text-xs font-semibold text-zinc-300 tracking-wide">Notifications</h3>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-600/15 text-red-400 font-medium">{unreadCount} new</span>
          )}
          <span className="text-[9px] text-zinc-600">{notifications.length} total</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
        {visible.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <p className="text-xs text-zinc-600">No notifications yet</p>
            <p className="text-[10px] text-zinc-700 mt-1">Admin notifications will appear here</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {visible.map((n, i) => (
              <TimelineEntry key={n.id} n={n} index={i} />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Footer */}
      {hasMore && (
        <button
          onClick={() => setLimit((prev) => prev + 8)}
          className="w-full py-2.5 text-[9px] font-medium text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.02] transition-all border-t border-white/[0.04]"
        >
          Load {notifications.length - limit} more
        </button>
      )}
    </div>
  );
}

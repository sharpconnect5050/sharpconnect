"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getFilteredNotifications, getFilteredUnreadCount, markAsRead, markAllAsRead,
  onNotify, subscribeToNotifications, getNotificationDeepLink,
  getNotificationGroup, getNotificationGroupColor, GROUP_META,
  getPriorityBorder, getPriorityGlow,
  downloadNotifications, exportNotificationsToCSV,
  type AppNotification, type NotificationPriority, type NotificationGroup,
} from "@/lib/notifications";
import NotificationPreferencesPanel from "./NotificationPreferences";

/* ─── CONSTANTS ──────────────────────────────────────────── */

const PRIORITY_DOT: Record<NotificationPriority, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-blue-500",
  low: "bg-zinc-600",
};

const PRIORITY_LABEL: Record<NotificationPriority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const TYPE_ICON: Record<string, string> = {
  new_campaign: "🎵",
  payment_uploaded: "💰",
  payment_approved: "✅",
  editor_assigned: "👤",
  editor_submitted: "🎬",
  revision_requested: "🔄",
  admin_approved: "👍",
  campaign_scheduled: "📅",
  post_submitted: "📤",
  post_verified: "🔗",
  overdue_campaign: "⏰",
  campaign_completed: "🎉",
  support_request: "💬",
  ai_alert: "🤖",
};

type FilterTab = "all" | "unread";

/* ─── RELATIVE TIME ──────────────────────────────────────── */

function formatRelativeTime(iso: string): string {
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

/* ─── TOAST POPUP ────────────────────────────────────────── */

const Toast = React.memo(function Toast({ notif, onDismiss }: { notif: AppNotification; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(notif.id), 4000);
    return () => clearTimeout(timer);
  }, [onDismiss, notif.id]);

  return (
    <motion.a
      href={getNotificationDeepLink(notif)}
      initial={{ opacity: 0, y: -12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.96, transition: { duration: 0.15 } }}
      className="relative w-full rounded-xl border border-white/10 bg-[#0a0a0a]/95 backdrop-blur-2xl shadow-2xl shadow-black/60 overflow-hidden cursor-pointer group"
    >
      {/* Priority accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${notif.priority === "urgent" ? "bg-red-500" : notif.priority === "high" ? "bg-orange-500" : "bg-transparent"}`} />
      <div className="flex items-start gap-2.5 p-3 pl-3.5">
        <span className="text-base mt-0.5 shrink-0">{TYPE_ICON[notif.type] || "📌"}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold text-white truncate">{notif.title}</p>
            <span className={`text-[9px] font-medium px-1 py-0.5 rounded shrink-0 ${
              notif.priority === "urgent" ? "bg-red-500/15 text-red-400" :
              notif.priority === "high" ? "bg-orange-500/15 text-orange-400" :
              "bg-zinc-500/15 text-zinc-500"
            }`}>
              {PRIORITY_LABEL[notif.priority]}
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">{notif.message}</p>
        </div>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDismiss(notif.id); }}
          className="shrink-0 p-0.5 text-zinc-700 hover:text-zinc-400 transition-colors opacity-0 group-hover:opacity-100"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </motion.a>
  );
});

/* ─── NOTIFICATION CARD ──────────────────────────────────── */

function NotificationCard({ n, onRead }: { n: AppNotification; onRead: (id: string) => void }) {
  const group = getNotificationGroup(n);
  const groupMeta = GROUP_META[group];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <a
        href={getNotificationDeepLink(n)}
        onClick={() => !n.read && onRead(n.id)}
        className={`group relative flex items-start gap-3 px-4 py-3 transition-all hover:bg-white/[0.03] ${
          !n.read ? "bg-white/[0.015]" : ""
        }`}
      >
        {/* Priority accent bar */}
        <div className={`absolute left-0 top-1 bottom-1 w-[2.5px] rounded-r-full transition-all duration-300 ${
          n.priority === "urgent" ? "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.3)]" :
          n.priority === "high" ? "bg-orange-500" :
          n.priority === "medium" ? "bg-blue-500/50" :
          "bg-zinc-700"
        } ${!n.read ? "opacity-100" : "opacity-30 group-hover:opacity-60"}`} />

        {/* Icon */}
        <div className={`relative w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0 mt-0.5 border transition-all duration-200 ${
          getNotificationGroupColor(group)
        } group-hover:scale-105`}>
          {groupMeta.icon}
          {!n.read && (
            <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0a0a0a] ${
              n.priority === "urgent" ? "bg-red-500 animate-pulse" : "bg-red-500"
            }`} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-xs font-semibold truncate transition-colors ${
              n.read ? "text-zinc-500" : "text-white"
            }`}>
              {n.title}
            </p>
            <span className={`text-[9px] font-medium px-1 py-0.5 rounded shrink-0 ${
              n.priority === "urgent" ? "bg-red-500/10 text-red-400" :
              n.priority === "high" ? "bg-orange-500/10 text-orange-400" :
              n.priority === "medium" ? "bg-blue-500/10 text-blue-400" :
              "bg-zinc-500/10 text-zinc-500"
            }`}>
              {PRIORITY_LABEL[n.priority]}
            </span>
          </div>
          <p className={`text-[11px] mt-0.5 line-clamp-2 transition-colors ${
            n.read ? "text-zinc-500/80" : "text-zinc-300"
          }`}>
            {n.message}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${getNotificationGroupColor(group)}`}>
              {groupMeta.label}
            </span>
            <span className="text-[9px] text-zinc-700 font-mono">{formatRelativeTime(n.createdAt)}</span>
            {n.campaignId && (
              <span className="text-[8px] text-zinc-800 font-mono truncate max-w-[80px]">{n.campaignId}</span>
            )}
          </div>
        </div>

        {/* Mark read button (unread only) */}
        {!n.read && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRead(n.id); }}
            className="shrink-0 self-center w-6 h-6 rounded-full border border-white/[0.06] flex items-center justify-center text-zinc-600 hover:text-zinc-300 hover:border-white/20 hover:bg-white/[0.04] transition-all opacity-0 group-hover:opacity-100"
            title="Mark as read"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        )}
      </a>
    </motion.div>
  );
}

/* ─── SEGMENT CONTROL ────────────────────────────────────── */

function SegmentControl({ value, onChange, unread }: { value: FilterTab; onChange: (v: FilterTab) => void; unread: number }) {
  return (
    <div className="flex bg-white/[0.04] rounded-lg p-0.5 gap-0.5">
      {(["all", "unread"] as const).map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`relative px-3 py-1 rounded-md text-[10px] font-medium transition-all capitalize ${
            value === tab ? "text-white" : "text-zinc-600 hover:text-zinc-400"
          }`}
        >
          {value === tab && (
            <motion.div
              layoutId="segment-active"
              className="absolute inset-0 rounded-md bg-white/[0.08]"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-1">
            {tab}
            {tab === "unread" && unread > 0 && (
              <span className="text-[8px] font-bold px-1 py-0.5 rounded-full bg-red-600/20 text-red-400">{unread}</span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ─── BELL ICON ──────────────────────────────────────────── */

function BellIcon({ urgent }: { urgent: boolean }) {
  return (
    <svg className={`w-5 h-5 ${urgent ? "text-red-400" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      {urgent && (
        <motion.circle
          cx="12" cy="6" r="2.5"
          fill="#ef4444"
          initial={{ scale: 0 }}
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        />
      )}
    </svg>
  );
}

/* ─── PRIORITY SUMMARY BAR ───────────────────────────────── */

function PrioritySummary({ notifications }: { notifications: AppNotification[] }) {
  const counts = useMemo(() => {
    const urgent = notifications.filter((n) => !n.read && n.priority === "urgent").length;
    const high = notifications.filter((n) => !n.read && n.priority === "high").length;
    const medium = notifications.filter((n) => !n.read && n.priority === "medium").length;
    return { urgent, high, medium };
  }, [notifications]);

  const items = [
    { key: "urgent", count: counts.urgent, dot: "bg-red-500", label: "Urgent", glow: "shadow-[0_0_4px_rgba(239,68,68,0.3)]" },
    { key: "high", count: counts.high, dot: "bg-orange-500", label: "High", glow: "" },
    { key: "medium", count: counts.medium, dot: "bg-blue-500", label: "Medium", glow: "" },
  ].filter((i) => i.count > 0);

  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-white/[0.02] border-b border-white/[0.04] shrink-0">
      {items.map((item) => (
        <div key={item.key} className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${item.dot} ${item.glow}`} />
          <span className="text-[10px] text-zinc-500 font-medium">
            {item.count} <span className="text-zinc-600">{item.label.toLowerCase()}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── EMPTY STATE ────────────────────────────────────────── */

function EmptyState({ filter }: { filter: FilterTab }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="relative mb-4"
      >
        <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
          <svg className="w-8 h-8 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
          <svg className="w-2 h-2 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </motion.div>
      <p className="text-sm text-zinc-500 font-semibold">All clear</p>
      <p className="text-xs text-zinc-700 mt-1">
        {filter === "unread" ? "No unread notifications" : "No notifications yet"}
      </p>
    </div>
  );
}

/* ─── NOTIFICATION CENTER ────────────────────────────────── */

export { addAlert } from "@/lib/notifications";

export default function AdminNotificationBell() {
  const [open, setOpen] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [urgentUnread, setUrgentUnread] = useState(0);
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState<FilterTab>("all");
  const ref = useRef<HTMLDivElement>(null);
  const prevUnreadRef = useRef(unread);

  const refresh = useCallback(() => {
    setNotifications(getFilteredNotifications().slice(0, 50));
    const u = getFilteredUnreadCount();
    setUnread(u);
    setUrgentUnread(
      getFilteredNotifications().filter((n) => !n.read && n.priority === "urgent").length
    );
    prevUnreadRef.current = u;
  }, []);

  useEffect(() => {
    refresh();
    const unsub = onNotify(refresh);
    const interval = setInterval(refresh, 3000);
    return () => { unsub(); clearInterval(interval); };
  }, [refresh]);

  // Supabase realtime subscription
  useEffect(() => {
    const unsub = subscribeToNotifications((n) => {
      refresh();
      setToasts((prev) => [n, ...prev].slice(0, 3));
    });
    return unsub;
  }, [refresh]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleMarkAllRead = () => {
    markAllAsRead();
    refresh();
  };

  const handleRead = (id: string) => {
    markAsRead(id);
    refresh();
  };

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const filtered = useMemo(() => {
    if (filter === "unread") return notifications.filter((n) => !n.read);
    return notifications;
  }, [notifications, filter]);

  // Group by category for display
  const grouped = useMemo(() => {
    const groups: { group: NotificationGroup; notifications: AppNotification[] }[] = [];
    const map = new Map<NotificationGroup, AppNotification[]>();
    for (const n of filtered) {
      const g = getNotificationGroup(n);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(n);
    }
    for (const [group, items] of map) {
      groups.push({ group, notifications: items });
    }
    return groups.sort((a, b) => {
      const order: NotificationGroup[] = ["workflow", "revision", "scheduling", "payment", "artist", "ai", "other"];
      return order.indexOf(a.group) - order.indexOf(b.group);
    });
  }, [filtered]);

  const staggerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.03 },
    },
  };

  return (
    <>
      {/* Toasts — stacked top-right */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)] pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto">
              <Toast notif={t} onDismiss={dismissToast} />
            </div>
          ))}
        </AnimatePresence>
      </div>

      {/* Bell + Slideout */}
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="relative p-2 text-zinc-400 hover:text-white transition-colors"
          aria-label="Notifications"
        >
          <BellIcon urgent={urgentUnread > 0} />
          {unread > 0 && (
            <span className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center shadow-lg ${
              urgentUnread > 0
                ? "bg-red-600 shadow-red-600/40"
                : "bg-zinc-600 shadow-black/30"
            }`}>
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        {/* Slideout panel */}
        <AnimatePresence>
          {open && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
              />
              {/* Panel */}
              <motion.div
                initial={{ opacity: 0, x: 340 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 340 }}
                transition={{ type: "spring", damping: 28, stiffness: 320 }}
                className="fixed right-0 top-0 bottom-0 w-full sm:w-[420px] bg-[#0a0a0a]/98 backdrop-blur-2xl border-l border-white/[0.06] shadow-2xl shadow-black/80 z-50 flex flex-col"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <BellIcon urgent={urgentUnread > 0} />
                      {urgentUnread > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-ping" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Notifications</h3>
                      {unread > 0 && (
                        <p className="text-[9px] text-zinc-600 mt-0.5">{unread} unread · {urgentUnread > 0 && `${urgentUnread} urgent`}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {unread > 0 && (
                      <button onClick={handleMarkAllRead}
                        className="px-2 py-1 rounded-md text-[9px] font-medium text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-all"
                      >
                        Dismiss all
                      </button>
                    )}
                    <button onClick={() => setShowPrefs(!showPrefs)}
                      className={`p-1.5 rounded-lg transition-all ${
                        showPrefs
                          ? "text-red-400 bg-red-500/10"
                          : "text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04]"
                      }`}
                      title="Notification preferences"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                    <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04] transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Preferences panel */}
                {showPrefs ? (
                  <NotificationPreferencesPanel onBack={() => setShowPrefs(false)} />
                ) : (
                  <>
                    {/* Filter + actions row */}
                    <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.04] shrink-0">
                      <SegmentControl value={filter} onChange={setFilter} unread={unread} />
                      {unread > 0 && filter === "all" && (
                        <button onClick={handleMarkAllRead}
                          className="text-[9px] font-medium text-zinc-600 hover:text-zinc-400 transition-colors"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    {/* Priority summary bar */}
                    <PrioritySummary notifications={notifications} />

                    {/* Notification list */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                      {filtered.length === 0 ? (
                        <EmptyState filter={filter} />
                      ) : (
                        <motion.div
                          variants={staggerVariants}
                          initial="hidden"
                          animate="visible"
                          className="divide-y divide-white/[0.03]"
                        >
                          {grouped.map(({ group, notifications: items }) => (
                            <div key={group}>
                              {/* Group header */}
                              <div className="sticky top-0 z-10 bg-[#0a0a0a]/90 backdrop-blur-xl">
                                <div className="flex items-center gap-2 px-4 py-2">
                                  <div className="h-px flex-1 bg-white/[0.04]" />
                                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-medium border ${getNotificationGroupColor(group)}`}>
                                    <span>{GROUP_META[group].icon}</span>
                                    <span>{GROUP_META[group].label}</span>
                                  </div>
                                  <div className="h-px flex-1 bg-white/[0.04]" />
                                </div>
                              </div>
                              {items.map((n) => (
                                <NotificationCard key={n.id} n={n} onRead={handleRead} />
                              ))}
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/[0.04] shrink-0">
                      <p className="text-[9px] text-zinc-700">
                        {unread > 0
                          ? `${unread} unread · ${notifications.length} total`
                          : `${notifications.length} notification${notifications.length !== 1 ? "s" : ""}`
                        }
                      </p>
                      <div className="flex items-center gap-2">
                        {notifications.length > 0 && (
                          <>
                            <div className="relative group/export">
                              <button
                                className="text-[8px] text-zinc-700 hover:text-zinc-500 transition-colors flex items-center gap-1"
                                title="Export notifications"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                </svg>
                              </button>
                              <div className="absolute right-0 bottom-full mb-1 hidden group-hover/export:block z-50">
                                <div className="w-32 rounded-xl border border-white/[0.08] bg-[#0a0a0a] backdrop-blur-2xl shadow-2xl overflow-hidden">
                                  <button onClick={() => { downloadNotifications(notifications, "csv"); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-[9px] text-zinc-300 hover:bg-white/[0.04] transition-colors"
                                  >Export CSV</button>
                                  <button onClick={() => { downloadNotifications(notifications, "json"); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-[9px] text-zinc-300 hover:bg-white/[0.04] border-t border-white/[0.06] transition-colors"
                                  >Export JSON</button>
                                  <button onClick={() => { downloadNotifications(notifications, "pdf"); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-[9px] text-zinc-300 hover:bg-white/[0.04] border-t border-white/[0.06] transition-colors"
                                  >Export PDF</button>
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => { localStorage.removeItem("sharpconnect_notifications"); refresh(); }}
                              className="text-[8px] text-zinc-800 hover:text-zinc-600 transition-colors"
                            >
                              Clear all
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

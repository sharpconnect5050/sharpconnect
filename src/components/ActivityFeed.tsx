"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Activity {
  id: string;
  time: string;
  icon: string;
  label: string;
  detail: string;
  status: "success" | "warning" | "info" | "urgent";
}

const STATUS_COLORS: Record<string, string> = {
  success: "bg-emerald-500/20 text-emerald-400 border-emerald-500/20",
  warning: "bg-amber-500/20 text-amber-400 border-amber-500/20",
  info: "bg-blue-500/20 text-blue-400 border-blue-500/20",
  urgent: "bg-red-500/20 text-red-400 border-red-500/20",
};
const DOT_COLORS: Record<string, string> = {
  success: "bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]",
  warning: "bg-amber-500 shadow-[0_0_6px_rgba(251,191,36,0.5)]",
  info: "bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)]",
  urgent: "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)] animate-pulse-urgent",
};

// Generate sample activity from localStorage data
function buildActivities(): Activity[] {
  const items: Activity[] = [];
  try {
    const campaigns = JSON.parse(localStorage.getItem("sharpconnect_submissions") || "[]");
    const schedules = JSON.parse(localStorage.getItem("sharpconnect_schedules") || "[]");
    const reviews = JSON.parse(localStorage.getItem("sharpconnect_review_history") || "[]");

    campaigns.forEach((c: any) => {
      if (c.status === "Pending Verification") {
        items.push({
          id: `pay-${c.campaignId}`,
          time: c.submittedAt ? new Date(c.submittedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "",
          icon: "💰",
          label: "Payment Received",
          detail: `${c.artistName} — ${c.campaignId}`,
          status: "warning",
        });
      }
      if (c.status === "Pending Admin Review") {
        items.push({
          id: `review-${c.campaignId}`,
          time: c.submittedAt ? new Date(c.submittedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "",
          icon: "🎬",
          label: "Editor Submitted",
          detail: `${c.artistName} ready for review`,
          status: "info",
        });
      }
      if (c.status === "Completed") {
        items.push({
          id: `done-${c.campaignId}`,
          time: c.submittedAt ? new Date(c.submittedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "",
          icon: "🎉",
          label: "Campaign Complete",
          detail: `${c.artistName} — ${c.songTitle}`,
          status: "success",
        });
      }
      if (c.status === "Approved By Artist") {
        items.push({
          id: `artist-${c.campaignId}`,
          time: c.submittedAt ? new Date(c.submittedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "",
          icon: "👍",
          label: "Artist Approved",
          detail: `${c.artistName} approved campaign`,
          status: "success",
        });
      }
    });

    schedules.forEach((s: any) => {
      if (s.postingStatus === "Posted") {
        items.push({
          id: `sched-${s.id}`,
          time: s.scheduledTime || "",
          icon: "📤",
          label: "Post Published",
          detail: `${s.campaignId} on ${s.platformName}`,
          status: "success",
        });
      }
      if (s.postingStatus === "Pending Verification") {
        items.push({
          id: `schedv-${s.id}`,
          time: s.scheduledTime || "",
          icon: "🔗",
          label: "Link Submitted",
          detail: `${s.campaignId} awaiting verification`,
          status: "info",
        });
      }
    });

    reviews.forEach((r: any) => {
      items.push({
        id: `hist-${r.campaignId}-${r.timestamp}`,
        time: r.timestamp ? new Date(r.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "",
        icon: r.action === "approved" ? "✅" : "🔄",
        label: r.action === "approved" ? "Review Approved" : "Revision Requested",
        detail: `${r.campaignId} ${r.action === "approved" ? "approved" : "sent for revision"}`,
        status: r.action === "approved" ? "success" : "warning",
      });
    });
  } catch {}

  items.sort((a, b) => {
    if (!a.time && !b.time) return 0;
    if (!a.time) return 1;
    if (!b.time) return -1;
    return b.time.localeCompare(a.time);
  });

  return items.slice(0, 15);
}

export default function ActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    setActivities(buildActivities());
    let pending: ReturnType<typeof setTimeout>;
    const interval = setInterval(() => {
      setActivities(buildActivities());
      setPulse(true);
      pending = setTimeout(() => setPulse(false), 500);
    }, 10000);
    return () => { clearInterval(interval); clearTimeout(pending); };
  }, []);

  const hasUrgent = useMemo(() => activities.some((a) => a.status === "urgent"), [activities]);

  return (
    <div className="glass-card-premium overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className={`w-2 h-2 rounded-full ${hasUrgent ? "bg-red-500 animate-pulse-urgent" : "bg-emerald-500"}`} />
          <h3 className="text-xs font-semibold text-zinc-300 tracking-wide">Activity Feed</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full bg-emerald-500 transition-opacity ${pulse ? "opacity-100" : "opacity-40"}`}
            style={{ boxShadow: pulse ? "0 0 6px rgba(34,197,94,0.6)" : "none" }} />
          <span className="text-[9px] text-zinc-600">{activities.length} events</span>
        </div>
      </div>

      <div className="max-h-[320px] overflow-y-auto hide-scrollbar">
        {activities.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-xs text-zinc-600">No activity yet</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {activities.map((a) => (
              <motion.div
                key={a.id}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.25 }}
                className="flex items-start gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors border-b border-white/[0.02] last:border-0"
              >
                <span className="text-sm mt-0.5 shrink-0">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_COLORS[a.status] || "bg-zinc-500"}`} />
                    <p className="text-xs font-medium text-zinc-300">{a.label}</p>
                    <span className="text-[9px] text-zinc-600 ml-auto shrink-0">{a.time}</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5 pl-[18px] truncate">{a.detail}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

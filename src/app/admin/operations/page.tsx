"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { getCampaigns, formatCurrency, type Campaign, type CampaignStatus } from "@/lib/adminData";
import { getEventLogs, type EventLog } from "@/lib/events";
import { getTodaySchedules, getPendingVerificationSchedules, getMissingLinkSchedules, type PostingSchedule } from "@/lib/scheduling";
import { getRecentActivityLog, formatActivityTime, type ActivityEntry } from "@/lib/activity-log";

const APPROVAL_STATUSES: CampaignStatus[] = ["Pending Admin Review", "Pending Artist Review"];
const REVISION_STATUSES: CampaignStatus[] = ["Needs Revision", "Artist Revision Requested"];
const LIVE_STATUSES: CampaignStatus[] = ["Posted", "Completed"];
const ACTIVE_STATUSES: CampaignStatus[] = [
  "Pending Verification", "Paid", "Assigned", "Editing", "Pending Admin Review",
  "Needs Revision", "Approved", "Pending Artist Review", "Artist Revision Requested",
  "Approved By Artist", "Ready To Schedule", "Template Created", "Scheduled",
];
const AWAITING_POSTING: CampaignStatus[] = ["Ready To Schedule", "Template Created", "Approved By Artist"];
const AWAITING_ARTIST: CampaignStatus[] = ["Pending Artist Review", "Artist Revision Requested"];

interface AlertItem {
  id: string;
  type: "overdue" | "stalled" | "missing" | "pending_long" | "unscheduled";
  severity: "critical" | "warning" | "info";
  campaignId: string;
  title: string;
  description: string;
}

export default function OperationsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [schedules, setSchedules] = useState<PostingSchedule[]>([]);
  const [now, setNow] = useState(new Date());

  const load = () => {
    const mnt = { current: true };
    getCampaigns().then((d) => { if (mnt.current) setCampaigns(d); }).catch(console.error);
    getEventLogs(100).then((d) => { if (mnt.current) setEvents(d); }).catch(console.error);
    setSchedules(getTodaySchedules());
    setActivity(getRecentActivityLog(30));
    return () => { mnt.current = false; };
  };

  useEffect(() => { const c = load(); return c; }, []);
  useEffect(() => {
    const t = setInterval(() => { setNow(new Date()); }, 60000);
    const r = setInterval(() => {
      getCampaigns().then(setCampaigns).catch(console.error);
      setSchedules(getTodaySchedules());
      setActivity(getRecentActivityLog(30));
    }, 30000);
    return () => { clearInterval(t); clearInterval(r); };
  }, []);

  const stats = useMemo(() => {
    const active = campaigns.filter((c) => ACTIVE_STATUSES.includes(c.status));
    const pendingApproval = campaigns.filter((c) => APPROVAL_STATUSES.includes(c.status));
    const revisions = campaigns.filter((c) => REVISION_STATUSES.includes(c.status));
    const todayScheduled = schedules;
    const live = campaigns.filter((c) => LIVE_STATUSES.includes(c.status));
    const pendingTikTok = getPendingVerificationSchedules().length + getMissingLinkSchedules().length;
    return { active: active.length, pendingApproval: pendingApproval.length, revisions: revisions.length, todayScheduled: todayScheduled.length, live: live.length, pendingTikTok };
  }, [campaigns, schedules]);

  const alerts = useMemo((): AlertItem[] => {
    const result: AlertItem[] = [];
    const nowMs = Date.now();
    const DAY_MS = 86400000;

    for (const c of campaigns) {
      if (c.status === "Artist Revision Requested" || c.status === "Needs Revision") {
        const age = nowMs - new Date(c.submittedAt).getTime();
        if (age > DAY_MS * 3) {
          result.push({
            id: `stalled-${c.campaignId}`, type: "stalled", severity: "critical",
            campaignId: c.campaignId, title: "Stalled Revision",
            description: `${c.artistName} — ${c.songTitle} has been waiting ${Math.floor(age / DAY_MS)} days.`,
          });
        }
      }
      if (c.status === "Pending Admin Review" || c.status === "Pending Artist Review") {
        const age = nowMs - new Date(c.submittedAt).getTime();
        if (age > DAY_MS) {
          result.push({
            id: `pending-${c.campaignId}`, type: "pending_long", severity: "warning",
            campaignId: c.campaignId, title: "Approval Pending >24h",
            description: `${c.artistName} awaiting approval for ${Math.floor(age / DAY_MS)} days.`,
          });
        }
      }
      if (["Ready To Schedule", "Template Created", "Approved By Artist"].includes(c.status)) {
        const age = nowMs - new Date(c.submittedAt).getTime();
        if (age > DAY_MS * 5) {
          result.push({
            id: `unscheduled-${c.campaignId}`, type: "unscheduled", severity: "warning",
            campaignId: c.campaignId, title: "Unscheduled Campaign",
            description: `${c.artistName} approved ${Math.floor(age / DAY_MS)} days ago, not yet scheduled.`,
          });
        }
      }
    }

    const overdueSchedules = schedules.filter((s) => {
      if (s.postingStatus === "Posted" || s.postingStatus === "Failed") return false;
      const schedDate = new Date(`${s.scheduledDate}T${s.scheduledTime || "23:59"}`);
      return schedDate.getTime() < nowMs;
    });
    for (const s of overdueSchedules) {
      if (!result.find((a) => a.campaignId === s.campaignId && a.type === "overdue")) {
        result.push({
          id: `overdue-${s.id}`, type: "overdue", severity: "critical",
          campaignId: s.campaignId, title: "Overdue Post",
          description: `${s.platformName} post overdue — scheduled ${s.scheduledDate}.`,
        });
      }
    }

    const missingLinks = getMissingLinkSchedules();
    for (const s of missingLinks) {
      if (!result.find((a) => a.campaignId === s.campaignId && a.type === "missing")) {
        result.push({
          id: `missing-${s.id}`, type: "missing", severity: "warning",
          campaignId: s.campaignId, title: "Missing TikTok Link",
          description: `${s.platformName} schedule ${s.scheduledDate} has no post URL yet.`,
        });
      }
    }

    return result.sort((a, b) => (a.severity === "critical" ? -1 : b.severity === "critical" ? 1 : 0));
  }, [campaigns, schedules]);

  const pipeline = useMemo(() => {
    const counts: Record<string, { label: string; count: number; total: number; statuses: CampaignStatus[] }> = {
      payment: { label: "Payment", count: 0, total: campaigns.length || 1, statuses: ["Pending Verification", "Paid"] },
      production: { label: "Production", count: 0, total: campaigns.length || 1, statuses: ["Assigned", "Editing", "Pending Admin Review", "Needs Revision", "Approved", "Pending Artist Review", "Artist Revision Requested", "Approved By Artist"] },
      delivery: { label: "Delivery", count: 0, total: campaigns.length || 1, statuses: ["Ready To Schedule", "Template Created", "Scheduled", "Posted", "Completed"] },
    };
    for (const c of campaigns) {
      if (counts.payment.statuses.includes(c.status)) counts.payment.count++;
      if (counts.production.statuses.includes(c.status)) counts.production.count++;
      if (counts.delivery.statuses.includes(c.status)) counts.delivery.count++;
    }
    return counts;
  }, [campaigns]);

  const awaitingPosting = useMemo(() => campaigns.filter((c) => AWAITING_POSTING.includes(c.status)), [campaigns]);
  const awaitingArtist = useMemo(() => campaigns.filter((c) => AWAITING_ARTIST.includes(c.status)), [campaigns]);

  return (
    <div className="space-y-5 lg:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-lg shadow-emerald-500/40" />
            Operations
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            {new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now)}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-[10px] text-zinc-600 bg-white/[0.03] px-3 py-1.5 rounded-full border border-white/[0.06]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {stats.active} active
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {[
          { label: "Active", value: stats.active, color: "from-blue-500 to-blue-600", bg: "bg-blue-500/10" },
          { label: "Pending", value: stats.pendingApproval, color: "from-amber-500 to-amber-600", bg: "bg-amber-500/10" },
          { label: "Today", value: stats.todayScheduled, color: "from-emerald-500 to-emerald-600", bg: "bg-emerald-500/10" },
          { label: "Revisions", value: stats.revisions, color: "from-red-500 to-red-600", bg: "bg-red-500/10", pulse: stats.revisions > 0 },
          { label: "Live", value: stats.live, color: "from-purple-500 to-purple-600", bg: "bg-purple-500/10" },
          { label: "TikTok", value: stats.pendingTikTok, color: "from-pink-500 to-pink-600", bg: "bg-pink-500/10", pulse: stats.pendingTikTok > 0 },
        ].map((s) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className={`relative rounded-xl border border-white/[0.06] ${s.bg} backdrop-blur-xl p-3 sm:p-4 overflow-hidden`}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${s.color} opacity-[0.03]`} />
            <p className="text-[10px] sm:text-[11px] text-zinc-500 font-medium uppercase tracking-wider">{s.label}</p>
            <p className={`text-xl sm:text-2xl font-bold mt-1 ${s.pulse ? "text-white" : "text-white"}`}>
              {s.value}
              {s.pulse && <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse ml-1.5 align-middle" />}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
        {/* Left column — Workflow + Health */}
        <div className="lg:col-span-2 space-y-5 lg:space-y-6">
          {/* Today's Workflow */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-4 sm:p-5"
          >
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
              Today&apos;s Workflow
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <WorkflowCard label="Scheduled Today" count={stats.todayScheduled} icon="📅" href="/admin/scheduling" />
              <WorkflowCard label="Pending Reviews" count={stats.pendingApproval} icon="👀" href="/admin/reviews" highlight={stats.pendingApproval > 0} />
              <WorkflowCard label="Awaiting Posting" count={awaitingPosting.length} icon="🚀" href="/admin/scheduling" highlight={awaitingPosting.length > 0} />
              <WorkflowCard label="Awaiting Artist" count={awaitingArtist.length} icon="🎨" href="/admin/kanban" highlight={awaitingArtist.length > 0} />
            </div>
          </motion.div>

          {/* Health Overview */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-4 sm:p-5"
          >
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              Pipeline Health
            </h2>
            <div className="space-y-3">
              {Object.entries(pipeline).map(([key, p]) => {
                const pct = Math.round((p.count / p.total) * 100);
                const isHealthy = pct <= 40;
                const isWarning = pct > 40 && pct <= 70;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isHealthy ? "bg-emerald-500" : isWarning ? "bg-amber-500" : "bg-red-500"}`} />
                        <span className="text-xs text-zinc-400 font-medium">{p.label}</span>
                      </div>
                      <span className="text-[11px] text-zinc-600">{p.count} campaigns</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${
                        isHealthy ? "bg-emerald-500/60" : isWarning ? "bg-amber-500/60" : "bg-red-500/60"
                      }`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Recent Activity */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-4 sm:p-5"
          >
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Recent Activity
            </h2>
            <div className="space-y-1 max-h-80 overflow-y-auto overscroll-contain">
              {activity.slice(0, 20).map((a) => (
                <div key={a.id} className="flex items-start gap-3 py-2 border-b border-white/[0.04] last:border-0">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                    a.category === "approval" ? "bg-emerald-500" :
                    a.category === "revision" ? "bg-amber-500" :
                    a.category === "payment" ? "bg-blue-500" :
                    a.category === "assignment" ? "bg-purple-500" :
                    a.category === "scheduling" ? "bg-pink-500" : "bg-zinc-600"
                  }`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-zinc-300 truncate">{a.title}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">{formatActivityTime(a.timestamp)}</p>
                  </div>
                </div>
              ))}
              {activity.length === 0 && (
                <p className="text-xs text-zinc-600 py-4 text-center">No recent activity</p>
              )}
            </div>
          </motion.div>
        </div>

        {/* Right column — Alerts */}
        <div className="space-y-5 lg:space-y-6">
          {/* Priority Alerts */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-4 sm:p-5"
          >
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              Priority Alerts
              {alerts.length > 0 && (
                <span className="text-[10px] bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded-full ml-auto font-mono">{alerts.length}</span>
              )}
            </h2>
            <div className="space-y-2 max-h-[28rem] overflow-y-auto overscroll-contain">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <p className="text-xs text-zinc-500 font-medium">All Clear</p>
                  <p className="text-[10px] text-zinc-600 mt-1">No issues requiring attention</p>
                </div>
              ) : (
                alerts.map((alert) => (
                  <div key={alert.id} className={`rounded-lg border p-3 ${
                    alert.severity === "critical"
                      ? "border-red-500/20 bg-red-500/[0.04]"
                      : "border-amber-500/20 bg-amber-500/[0.04]"
                  }`}>
                    <div className="flex items-start gap-2.5">
                      <span className={`text-lg shrink-0 mt-0.5 ${
                        alert.severity === "critical" ? "" : ""
                      }`}>
                        {alert.type === "overdue" ? "🔴" : alert.type === "stalled" ? "⚠️" : alert.type === "missing" ? "📎" : alert.type === "pending_long" ? "⏰" : "📋"}
                      </span>
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold ${
                          alert.severity === "critical" ? "text-red-400" : "text-amber-400"
                        }`}>{alert.title}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">{alert.description}</p>
                        <p className="text-[9px] text-zinc-700 font-mono mt-1">{alert.campaignId}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-4 sm:p-5"
          >
            <h2 className="text-sm font-semibold text-white mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Pending Approvals", href: "/admin/reviews", icon: "👀", highlight: stats.pendingApproval > 0 },
                { label: "Scheduling", href: "/admin/scheduling", icon: "📅" },
                { label: "Revisions", href: "/admin/kanban", icon: "🔄", highlight: stats.revisions > 0 },
                { label: "Live Campaigns", href: "/admin/campaigns", icon: "🔥" },
                { label: "Payments", href: "/admin/payments", icon: "💰" },
                { label: "Activity Log", href: "/admin/logs", icon: "📋" },
              ].map((a) => (
                <a key={a.label} href={a.href}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all active:scale-[0.98] touch-target ${
                    a.highlight ? "border-amber-500/20 bg-amber-500/[0.04] text-amber-400 hover:bg-amber-500/[0.08]" : "border-white/[0.06] text-zinc-400 hover:text-white hover:border-white/20 hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="text-sm">{a.icon}</span>
                  {a.label}
                </a>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function WorkflowCard({ label, count, icon, href, highlight }: {
  label: string; count: number; icon: string; href: string; highlight?: boolean;
}) {
  return (
    <a href={href}
      className={`rounded-xl border p-3 sm:p-4 transition-all active:scale-[0.98] ${
        highlight && count > 0
          ? "border-amber-500/20 bg-amber-500/[0.04]"
          : "border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]"
      } ${count > 0 ? "hover:border-white/20" : "opacity-60"}`}
    >
      <p className="text-lg mb-1">{icon}</p>
      <p className={`text-lg sm:text-xl font-bold ${highlight && count > 0 ? "text-amber-400" : "text-white"}`}>{count}</p>
      <p className="text-[10px] sm:text-[11px] text-zinc-500 truncate">{label}</p>
    </a>
  );
}

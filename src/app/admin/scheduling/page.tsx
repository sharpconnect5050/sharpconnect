"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCampaigns, updateCampaign, type Campaign } from "@/lib/adminData";
import {
  createSchedule, updateSchedule, deleteSchedule,
  getSchedulesByDate, getTodaySchedules, getOverdueSchedules, getAllSchedulesSorted,
  getPendingVerificationSchedules, verifyPostLink, createPostSubmissionTask,
  submitPostLink, validateTikTokUrl,
  TIKTOK_PAGES, type PostingSchedule, type PostingStatus,
} from "@/lib/scheduling";
import {
  logCampaignScheduled, logTikTokSubmitted, logTikTokVerified, logCampaignMarkedLive,
} from "@/lib/activity-log";
import { getSiteUrl } from "@/lib/config";

const STATUS_COLORS: Record<string, string> = {
  "Not Scheduled": "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  Scheduled: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Ready To Post": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Posted: "bg-green-500/10 text-green-400 border-green-500/20",
  Failed: "bg-red-500/10 text-red-400 border-red-500/20",
  Reposted: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getMonthDays(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < first; i++) days.push(null);
  for (let d = 1; d <= total; d++) days.push(d);
  return days;
}

function dateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatTimeDisplay(date: string, time: string): string {
  const dt = new Date(`${date}T${time}`);
  return dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function daysUntil(date: string): string {
  const diff = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  if (diff < 0) return "Overdue";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff <= 7) return `${diff}d`;
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

type ViewMode = "timeline" | "calendar";
type ListTab = "all" | "today" | "pending";

export default function AdminSchedulingPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(now.getDate());
  const [schedules, setSchedules] = useState<PostingSchedule[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("timeline");
  const [listTab, setListTab] = useState<ListTab>("today");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [postUrlInput, setPostUrlInput] = useState<Record<string, string>>({});

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PostingSchedule | null>(null);
  const [mCampaignId, setMCampaignId] = useState("");
  const [mPlatform, setMPlatform] = useState(TIKTOK_PAGES[0]);
  const [mDate, setMDate] = useState("");
  const [mTime, setMTime] = useState("12:00");
  const [mPoster, setMPoster] = useState("admin");
  const [mStatus, setMStatus] = useState<PostingStatus>("Scheduled");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setSchedules(getAllSchedulesSorted());
      try { const c = await getCampaigns(); if (mounted) setCampaigns(c); } catch {}
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const load = useCallback(async () => {
    setSchedules(getAllSchedulesSorted());
    try { setCampaigns(await getCampaigns()); } catch {}
    setLoading(false);
  }, []);

  const days = getMonthDays(year, month);
  const todayStr = now.toISOString().split("T")[0];
  const selectedDate = selectedDay ? dateStr(year, month, selectedDay) : "";

  const todaySchedules = getTodaySchedules();
  const overdue = getOverdueSchedules();
  const pendingVerification = getPendingVerificationSchedules();
  const readyForSchedule = campaigns.filter((c) => c.status === "Ready To Schedule" || c.status === "Approved");
  const daySchedules = selectedDate ? getSchedulesByDate(selectedDate) : [];
  const thisWeekSchedules = schedules.filter((s) => {
    if (s.postingStatus === "Posted" || s.postingStatus === "Reposted") return false;
    const sd = new Date(`${s.scheduledDate}T${s.scheduledTime}`);
    return sd > now && sd < new Date(now.getTime() + 7 * 86400000);
  }).length;

  const openCreate = (date?: string) => {
    setEditing(null);
    setMCampaignId(""); setMPlatform(TIKTOK_PAGES[0]); setMDate(date || todayStr);
    setMTime("12:00"); setMPoster("admin"); setMStatus("Scheduled");
    setShowModal(true);
  };

  const openEdit = (s: PostingSchedule) => {
    setEditing(s); setMCampaignId(s.campaignId); setMPlatform(s.platformName);
    setMDate(s.scheduledDate); setMTime(s.scheduledTime); setMPoster(s.assignedPoster);
    setMStatus(s.postingStatus); setShowModal(true);
  };

  const handleSave = () => {
    if (!mCampaignId || !mDate || !mTime) return;
    const data = { campaignId: mCampaignId, platformName: mPlatform, scheduledDate: mDate, scheduledTime: mTime, assignedPoster: mPoster, postingStatus: mStatus };
    if (editing) {
      updateSchedule(editing.id, data);
    } else {
      createSchedule(data);
      logCampaignScheduled(mCampaignId, mDate, mPlatform);
    }
    setShowModal(false); load();
  };

  const handleDelete = (id: string) => { deleteSchedule(id); load(); };

  const handleVerify = (id: string) => {
    verifyPostLink(id);
    const sch = schedules.find((s) => s.id === id);
    if (sch) {
      updateCampaign(sch.campaignId, { status: "Posted" } as any);
      logTikTokVerified(sch.campaignId, "admin");
      logCampaignMarkedLive(sch.campaignId, "admin", sch.postUrl || "");
    }
    load();
  };

  const handleSubmit = (id: string) => {
    const url = postUrlInput[id];
    if (!url) return;
    if (!validateTikTokUrl(url)) { alert("Invalid TikTok URL"); return; }
    submitPostLink(id, url, "admin");
    const sch = schedules.find((s) => s.id === id);
    if (sch) {
      updateCampaign(sch.campaignId, { status: "Posted" } as any);
      logTikTokSubmitted(sch.campaignId, "admin", url);
    }
    load();
  };

  const generateTaskLink = (sch: PostingSchedule) => {
    const task = createPostSubmissionTask(sch.id, sch.campaignId, sch.platformName, sch.assignedPoster);
    const link = `${getSiteUrl()}/post-submission/${task.taskId}`;
    navigator.clipboard.writeText(link).catch(() => {});
    setCopiedId(sch.id); setTimeout(() => setCopiedId(null), 2000);
  };

  const scheduleCard = (sch: PostingSchedule) => {
    const isOverdue = sch.postingStatus !== "Posted" && sch.postingStatus !== "Reposted" && new Date(`${sch.scheduledDate}T${sch.scheduledTime}`) < new Date();
    return (
      <motion.div key={sch.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
        className="rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all p-3 group"
      >
        <div className="flex items-start gap-3">
          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
            sch.postingStatus === "Posted" || sch.postingStatus === "Reposted" ? "bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]"
            : isOverdue ? "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]"
            : sch.postingStatus === "Ready To Post" ? "bg-amber-500"
            : sch.postingStatus === "Scheduled" ? "bg-blue-500"
            : "bg-zinc-500"
          }`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white">{sch.campaignId}</span>
                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[sch.postingStatus]}`}>{sch.postingStatus}</span>
                  {isOverdue && <span className="text-[9px] text-red-500 font-medium">Overdue</span>}
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-[10px] text-zinc-500">
                  <span>{sch.platformName}</span>
                  <span className="w-1 h-1 rounded-full bg-zinc-700" />
                  <span>{formatTimeDisplay(sch.scheduledDate, sch.scheduledTime)}</span>
                  {sch.assignedPoster !== "admin" && (
                    <><span className="w-1 h-1 rounded-full bg-zinc-700" /><span className="text-zinc-400">{sch.assignedPoster}</span></>
                  )}
                  <span className="ml-auto text-[8px] font-mono text-zinc-700">{daysUntil(sch.scheduledDate)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {(sch.postingStatus === "Scheduled" || sch.postingStatus === "Not Scheduled" || sch.postingStatus === "Ready To Post") && (
                  <>
                    <button onClick={() => openEdit(sch)} className="p-1.5 rounded-lg text-zinc-600 hover:text-white hover:bg-white/[0.06] transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => handleDelete(sch.id)} className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-white/[0.06] transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Action area */}
            {sch.postingStatus === "Posted" || sch.postingStatus === "Reposted" ? (
              <div className="mt-3 flex items-center gap-3 flex-wrap">
                {sch.postUrl && (
                  <a href={sch.postUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11px] text-red-400 hover:text-red-300 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    View on TikTok
                  </a>
                )}
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${sch.verificationStatus === "verified" ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
                  {sch.verificationStatus === "verified" ? "Verified" : "Pending"}
                </span>
                {sch.verificationStatus === "pending_verification" && (
                  <button onClick={() => handleVerify(sch.id)} className="text-[10px] px-2 py-0.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium transition-all">Verify</button>
                )}
              </div>
            ) : (
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <div className="flex-1 flex items-center gap-2">
                  <input value={postUrlInput[sch.id] || ""} onChange={(e) => setPostUrlInput((p) => ({ ...p, [sch.id]: e.target.value }))}
                    placeholder="Paste TikTok URL..."
                    className="flex-1 bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder:text-zinc-600 outline-none focus:border-red-500/30"
                  />
                  <button onClick={() => handleSubmit(sch.id)} disabled={!postUrlInput[sch.id]}
                    className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white text-[11px] font-semibold transition-all touch-target"
                  >Post</button>
                </div>
                <button onClick={() => { const l = generateTaskLink(sch); }} className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors flex items-center gap-1 shrink-0 touch-target">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                  {copiedId === sch.id ? "Copied!" : "Task link"}
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  if (loading) return <div className="flex items-center justify-center h-48"><div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      {/* ─── HEADER ─── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Posting Schedule</h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">{schedules.length} total {todaySchedules.length > 0 && `· ${todaySchedules.length} today`}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white/[0.04] rounded-xl p-0.5 border border-white/[0.06]">
            <button onClick={() => setView("timeline")} className={`px-3 py-2 rounded-lg text-[11px] font-medium transition-all touch-target ${view === "timeline" ? "bg-red-600 text-white" : "text-zinc-500 hover:text-white"}`}>Timeline</button>
            <button onClick={() => setView("calendar")} className={`px-3 py-2 rounded-lg text-[11px] font-medium transition-all touch-target ${view === "calendar" ? "bg-red-600 text-white" : "text-zinc-500 hover:text-white"}`}>Calendar</button>
          </div>
          <button onClick={() => openCreate()} className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-700 text-white text-xs font-semibold hover:from-red-500 hover:to-red-600 transition-all touch-target">+ Schedule</button>
        </div>
      </div>

      {/* ─── METRICS ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Today", value: todaySchedules.length, accent: "text-blue-400", desc: `${todaySchedules.filter((s) => s.postUrl).length} with link` },
          { label: "This Week", value: thisWeekSchedules, accent: "text-sky-400", desc: "upcoming posts" },
          { label: "Overdue", value: overdue.length, accent: overdue.length > 0 ? "text-red-400" : "text-zinc-500", desc: overdue.length > 0 ? "needs attention" : "none" },
          { label: "Pending Verify", value: pendingVerification.length, accent: pendingVerification.length > 0 ? "text-amber-400" : "text-zinc-500", desc: "TikTok links submitted" },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px opacity-30" style={{ background: `linear-gradient(90deg, transparent, ${m.accent.includes("text-") ? "currentColor" : "#666"}, transparent)` }} />
            <p className="text-[9px] text-zinc-600 uppercase tracking-wider">{m.label}</p>
            <p className={`text-xl font-bold mt-0.5 ${m.accent}`}>{m.value}</p>
            <p className="text-[9px] text-zinc-700 mt-0.5">{m.desc}</p>
          </div>
        ))}
      </div>

      {/* ─── PENDING VERIFICATION ALERT ─── */}
      {pendingVerification.length > 0 && view === "timeline" && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-xs">⚠️</div>
            <div>
              <p className="text-xs text-amber-400 font-semibold">{pendingVerification.length} post{pendingVerification.length > 1 ? "s" : ""} pending verification</p>
              <p className="text-[10px] text-zinc-500">TikTok link submitted — verify to make visible to client</p>
            </div>
          </div>
          <button onClick={() => { setView("timeline"); setListTab("pending"); }}
            className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-semibold transition-all shrink-0 touch-target"
          >Review</button>
        </motion.div>
      )}

      {/* ─── READY TO SCHEDULE QUEUE ─── */}
      {readyForSchedule.length > 0 && view === "timeline" && (
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.03] p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider">Ready to Schedule ({readyForSchedule.length})</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {readyForSchedule.slice(0, 5).map((c) => (
              <div key={c.campaignId} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20">
                <div>
                  <p className="text-[11px] font-medium text-white">{c.campaignId}</p>
                  <p className="text-[9px] text-zinc-500">{c.artistName}</p>
                </div>
                <button onClick={() => { setMCampaignId(c.campaignId); setMDate(todayStr); setMTime("12:00"); setShowModal(true); }}
                  className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[9px] font-semibold transition-all touch-target"
                >Schedule</button>
              </div>
            ))}
            {readyForSchedule.length > 5 && <span className="text-[10px] text-zinc-600 self-center">+{readyForSchedule.length - 5} more</span>}
          </div>
        </div>
      )}

      {/* ─── TIMELINE VIEW ─── */}
      {view === "timeline" && (
        <div className="space-y-3">
          {/* Tab bar */}
          <div className="flex gap-1.5">
            {[
              { key: "today" as ListTab, label: "Today", count: todaySchedules.length },
              { key: "all" as ListTab, label: "All", count: schedules.length },
              { key: "pending" as ListTab, label: "Pending Verify", count: pendingVerification.length },
            ].map((t) => (
              <button key={t.key} onClick={() => setListTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
                  listTab === t.key ? "bg-red-600/20 text-red-400 border-red-500/20" : "text-zinc-500 hover:text-zinc-300 border-transparent"
                }`}
              >
                {t.label} <span className="text-[10px] opacity-60">({t.count})</span>
              </button>
            ))}
          </div>

          {/* Cards */}
          <AnimatePresence mode="popLayout">
            {(listTab === "today" ? todaySchedules : listTab === "pending" ? pendingVerification : schedules).length === 0 ? (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
                <div className="w-10 h-10 rounded-full bg-white/[0.03] flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <p className="text-sm text-zinc-500">No {listTab === "today" ? "posts scheduled for today" : listTab === "pending" ? "pending verification posts" : "schedules yet"}</p>
              </div>
            ) : (
              (listTab === "today" ? todaySchedules : listTab === "pending" ? pendingVerification : schedules).map(scheduleCard)
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ─── CALENDAR VIEW ─── */}
      {view === "calendar" && (
        <div className="space-y-4">
          {/* Calendar nav */}
          <div className="flex items-center justify-between">
            <button onClick={() => { if (month === 0) { setYear(year - 1); setMonth(11); } else setMonth(month - 1); }}
              className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.04] transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h2 className="text-sm font-semibold text-white">{MONTHS[month]} {year}</h2>
            <button onClick={() => { if (month === 11) { setYear(year + 1); setMonth(0); } else setMonth(month + 1); }}
              className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.04] transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          {/* Calendar grid */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="grid grid-cols-7 border-b border-white/[0.06]">
              {DAYS.map((d) => (
                <div key={d} className="text-center text-[9px] text-zinc-600 py-2 font-medium uppercase tracking-wider">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day, idx) => {
                if (day === null) return <div key={`e-${idx}`} className="aspect-square" />;
                const ds = dateStr(year, month, day);
                const dayScheds = schedules.filter((s) => s.scheduledDate === ds);
                const isToday = ds === todayStr;
                const isSelected = selectedDay === day;
                const hasOverdue = dayScheds.some((s) => s.postingStatus !== "Posted" && s.postingStatus !== "Reposted" && new Date(`${s.scheduledDate}T${s.scheduledTime}`) < new Date());
                const hasPosted = dayScheds.some((s) => s.postingStatus === "Posted" || s.postingStatus === "Reposted");
                return (
                  <button key={ds} onClick={() => setSelectedDay(day)}
                    className={`aspect-square flex flex-col items-center justify-start pt-1.5 gap-0.5 text-xs transition-all relative ${
                      isSelected ? "bg-red-500/15" : "hover:bg-white/[0.03]"
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] transition-all ${
                      isToday ? "bg-red-600 text-white font-bold shadow-lg shadow-red-600/30" : isSelected ? "text-red-400" : "text-zinc-400"
                    }`}>{day}</span>
                    {dayScheds.length > 0 && (
                      <div className="flex items-center gap-0.5">
                        {dayScheds.slice(0, 4).map((s) => (
                          <div key={s.id} className={`w-1 h-1 rounded-full ${
                            s.postingStatus === "Posted" || s.postingStatus === "Reposted" ? "bg-emerald-500"
                            : hasOverdue && new Date(`${s.scheduledDate}T${s.scheduledTime}`) < new Date() ? "bg-red-500"
                            : "bg-blue-500"
                          }`} />
                        ))}
                      </div>
                    )}
                    {dayScheds.length > 0 && (
                      <span className="text-[7px] font-mono text-zinc-700 mt-0.5">{dayScheds.length}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected day schedules */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-white">
                {selectedDate === todayStr ? "Today" : formatTimeDisplay(selectedDate, "00:00")}
                <span className="text-zinc-500 font-normal ml-1">({daySchedules.length})</span>
              </h3>
              <button onClick={() => openCreate(selectedDate)} className="text-[11px] text-red-400 hover:text-red-300 transition-colors">+ Schedule</button>
            </div>
            <AnimatePresence mode="popLayout">
              {daySchedules.length === 0 ? (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
                  <p className="text-xs text-zinc-500">No posts scheduled for this day.</p>
                </div>
              ) : daySchedules.map(scheduleCard)}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Overdue bar */}
      {overdue.length > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-3 flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-red-500/20 flex items-center justify-center text-xs">🔴</div>
          <div className="flex-1">
            <p className="text-xs text-red-400 font-semibold">{overdue.length} overdue post{overdue.length > 1 ? "s" : ""}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{overdue.slice(0, 3).map((s) => s.campaignId).join(", ")}{overdue.length > 3 ? ` +${overdue.length - 3} more` : ""}</p>
          </div>
        </div>
      )}

      {/* ─── CREATE/EDIT MODAL ─── */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0a0a0a] backdrop-blur-2xl p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-sm font-bold text-white mb-4">{editing ? "Edit Schedule" : "New Schedule"}</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1 block">Campaign</label>
                  <input value={mCampaignId} onChange={(e) => setMCampaignId(e.target.value)} placeholder="SC-XXXX"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-red-500/30" />
                </div>
                <div>
                  <label className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1 block">TikTok Page</label>
                  <select value={mPlatform} onChange={(e) => setMPlatform(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-red-500/30"
                  >{TIKTOK_PAGES.map((p) => <option key={p} value={p}>{p}</option>)}</select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1 block">Date</label>
                    <input type="date" value={mDate} onChange={(e) => setMDate(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-red-500/30 [color-scheme:dark]" />
                  </div>
                  <div>
                    <label className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1 block">Time</label>
                    <input type="time" value={mTime} onChange={(e) => setMTime(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-red-500/30 [color-scheme:dark]" />
                  </div>
                </div>
                <div>
                  <label className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1 block">Status</label>
                  <select value={mStatus} onChange={(e) => setMStatus(e.target.value as PostingStatus)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-red-500/30"
                  >
                    <option value="Not Scheduled">Not Scheduled</option>
                    <option value="Scheduled">Scheduled</option>
                    <option value="Ready To Post">Ready To Post</option>
                    <option value="Failed">Failed</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1 block">Poster</label>
                  <input value={mPoster} onChange={(e) => setMPoster(e.target.value)} placeholder="admin, editor name..."
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-red-500/30" />
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl bg-white/[0.06] text-white text-xs font-semibold hover:bg-white/[0.1] transition-all">Cancel</button>
                <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 text-white text-xs font-semibold hover:from-red-500 hover:to-red-600 transition-all">Save</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

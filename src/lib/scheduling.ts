export type PostingStatus = "Not Scheduled" | "Scheduled" | "Ready To Post" | "Posted" | "Failed" | "Reposted";

export type VerificationStatus = "none" | "pending_verification" | "verified";

export interface PostingSchedule {
  id: string;
  campaignId: string;
  platformName: string;
  scheduledDate: string;
  scheduledTime: string;
  postedAt?: string;
  postUrl?: string;
  postingStatus: PostingStatus;
  assignedPoster: string;
  createdAt: string;
  verificationStatus?: VerificationStatus;
  submittedBy?: string;
  captionNotes?: string;
}

export interface PostPerformance {
  scheduleId: string;
  views: number;
  likes: number;
  shares: number;
  comments: number;
}

export interface PostSubmissionTask {
  taskId: string;
  scheduleId: string;
  campaignId: string;
  platformName: string;
  assignedPoster: string;
  createdAt: string;
  status: "pending" | "submitted" | "verified";
  tiktokUrl?: string;
  captionNotes?: string;
  submittedAt?: string;
  verifiedAt?: string;
}

import { isServerAvailable, apiSetAll } from "./data-api";

const SCHEDULES_KEY = "sharpconnect_schedules";
const PERFORMANCE_KEY = "sharpconnect_post_performance";
const SUBMISSION_TASKS_KEY = "sharpconnect_post_submission_tasks";

export const TIKTOK_PAGES = [
  "BennyEdits",
  "SharpConnect",
  "CapCutAfrica",
  "SharpEditz",
];

function genId(): string {
  return "sch_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function genTaskId(): string {
  return "pst_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ─── SCHEDULE CRUD ─────────────────────────────────────────────

function getSchedules(): PostingSchedule[] {
  try {
    const raw = localStorage.getItem(SCHEDULES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSchedules(schedules: PostingSchedule[]) {
  try {
    localStorage.setItem(SCHEDULES_KEY, JSON.stringify(schedules));
    syncSchedulesToServer(schedules);
  } catch {}
}

async function syncSchedulesToServer(schedules: PostingSchedule[]) {
  try { if (await isServerAvailable()) await apiSetAll("schedules", schedules); } catch {}
}

export function createSchedule(data: Omit<PostingSchedule, "id" | "createdAt">): PostingSchedule {
  const schedule: PostingSchedule = { ...data, id: genId(), createdAt: new Date().toISOString(), verificationStatus: "none" };
  const all = getSchedules();
  all.unshift(schedule);
  saveSchedules(all);
  return schedule;
}

export function updateSchedule(id: string, updates: Partial<PostingSchedule>): PostingSchedule | null {
  const all = getSchedules();
  const idx = all.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...updates };
  saveSchedules(all);
  return all[idx];
}

export function deleteSchedule(id: string) {
  const all = getSchedules().filter((s) => s.id !== id);
  saveSchedules(all);
}

export function getCampaignSchedules(campaignId: string): PostingSchedule[] {
  return getSchedules().filter((s) => s.campaignId === campaignId);
}

export function getAllSchedules(): PostingSchedule[] {
  return getSchedules();
}

export function getSchedulesByDate(date: string): PostingSchedule[] {
  return getSchedules().filter((s) => s.scheduledDate === date);
}

export function getSchedulesByStatus(status: PostingStatus): PostingSchedule[] {
  return getSchedules().filter((s) => s.postingStatus === status);
}

export function getTodaySchedules(): PostingSchedule[] {
  const today = new Date().toISOString().split("T")[0];
  return getSchedulesByDate(today);
}

export function getOverdueSchedules(): PostingSchedule[] {
  const now = new Date();
  return getSchedules().filter((s) => {
    if (s.postingStatus === "Posted" || s.postingStatus === "Reposted") return false;
    const scheduled = new Date(`${s.scheduledDate}T${s.scheduledTime}`);
    return scheduled < now;
  });
}

export function getUpcomingSchedules(days: number = 7): PostingSchedule[] {
  const now = new Date();
  const future = new Date(now.getTime() + days * 86400000);
  return getSchedules().filter((s) => {
    if (s.postingStatus === "Posted" || s.postingStatus === "Reposted") return false;
    const scheduled = new Date(`${s.scheduledDate}T${s.scheduledTime}`);
    return scheduled >= now && scheduled <= future;
  });
}

export function getAllSchedulesSorted(): PostingSchedule[] {
  return getSchedules().sort((a, b) => {
    const dateA = new Date(`${a.scheduledDate}T${a.scheduledTime}`);
    const dateB = new Date(`${b.scheduledDate}T${b.scheduledTime}`);
    return dateA.getTime() - dateB.getTime();
  });
}

// ─── POST SUBMISSION ───────────────────────────────────────────

export function validateTikTokUrl(url: string): boolean {
  const clean = url.trim();
  if (!clean.startsWith("http://") && !clean.startsWith("https://")) return false;
  try {
    const u = new URL(clean);
    return u.hostname === "tiktok.com" || u.hostname === "www.tiktok.com" || u.hostname === "vm.tiktok.com" || u.hostname.endsWith(".tiktok.com");
  } catch {
    return false;
  }
}

export function submitPostLink(scheduleId: string, tiktokUrl: string, submittedBy: string, captionNotes?: string): PostingSchedule | null {
  const schedule = updateSchedule(scheduleId, {
    postingStatus: "Posted",
    postUrl: tiktokUrl,
    postedAt: new Date().toISOString(),
    submittedBy,
    captionNotes,
    verificationStatus: "pending_verification",
  });

  const tasks = getSubmissionTasks();
  const taskIdx = tasks.findIndex((t) => t.scheduleId === scheduleId);
  if (taskIdx >= 0) {
    tasks[taskIdx] = {
      ...tasks[taskIdx],
      status: "submitted",
      tiktokUrl,
      captionNotes,
      submittedAt: new Date().toISOString(),
    };
    localStorage.setItem(SUBMISSION_TASKS_KEY, JSON.stringify(tasks));
  }

  return schedule;
}

export function verifyPostLink(scheduleId: string): PostingSchedule | null {
  const schedule = updateSchedule(scheduleId, { verificationStatus: "verified" });
  const tasks = getSubmissionTasks();
  const taskIdx = tasks.findIndex((t) => t.scheduleId === scheduleId);
  if (taskIdx >= 0) {
    tasks[taskIdx] = { ...tasks[taskIdx], status: "verified", verifiedAt: new Date().toISOString() };
    localStorage.setItem(SUBMISSION_TASKS_KEY, JSON.stringify(tasks));
  }
  return schedule;
}

// ─── SUBMISSION TASKS ──────────────────────────────────────────

function getSubmissionTasks(): PostSubmissionTask[] {
  try {
    const raw = localStorage.getItem(SUBMISSION_TASKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function createPostSubmissionTask(scheduleId: string, campaignId: string, platformName: string, assignedPoster: string): PostSubmissionTask {
  const tasks = getSubmissionTasks();
  const existing = tasks.find((t) => t.scheduleId === scheduleId);
  if (existing) return existing;
  const task: PostSubmissionTask = {
    taskId: genTaskId(),
    scheduleId,
    campaignId,
    platformName,
    assignedPoster,
    createdAt: new Date().toISOString(),
    status: "pending",
  };
  tasks.unshift(task);
  localStorage.setItem(SUBMISSION_TASKS_KEY, JSON.stringify(tasks));
  syncTasksToServer(tasks);
  return task;
}

async function syncTasksToServer(tasks: PostSubmissionTask[]) {
  try { if (await isServerAvailable()) await apiSetAll("schedule_tasks", tasks); } catch {}
}

export function getPostSubmissionTask(taskId: string): PostSubmissionTask | null {
  return getSubmissionTasks().find((t) => t.taskId === taskId) || null;
}

export function getScheduleSubmissionTask(scheduleId: string): PostSubmissionTask | null {
  return getSubmissionTasks().find((t) => t.scheduleId === scheduleId) || null;
}

export function getPendingPostSubmissionTasks(): PostSubmissionTask[] {
  return getSubmissionTasks().filter((t) => t.status === "pending");
}

export function getAllPostSubmissionTasks(): PostSubmissionTask[] {
  return getSubmissionTasks();
}

export function getMissingLinkSchedules(): PostingSchedule[] {
  const now = new Date();
  return getSchedules().filter((s) => {
    if (s.postingStatus === "Posted" || s.postingStatus === "Reposted") return false;
    const scheduled = new Date(`${s.scheduledDate}T${s.scheduledTime}`);
    return scheduled < now;
  });
}

export function getPendingVerificationSchedules(): PostingSchedule[] {
  return getSchedules().filter((s) => s.verificationStatus === "pending_verification");
}

// ─── PERFORMANCE ──────────────────────────────────────────────

function getPerformance(): PostPerformance[] {
  try {
    const raw = localStorage.getItem(PERFORMANCE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePerformance(data: PostPerformance[]) {
  try { localStorage.setItem(PERFORMANCE_KEY, JSON.stringify(data)); } catch {}
}

export function upsertPerformance(scheduleId: string, data: Partial<PostPerformance>): PostPerformance {
  const all = getPerformance();
  const idx = all.findIndex((p) => p.scheduleId === scheduleId);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...data };
    savePerformance(all);
    return all[idx];
  }
  const perf: PostPerformance = { scheduleId, views: 0, likes: 0, shares: 0, comments: 0, ...data };
  all.push(perf);
  savePerformance(all);
  return perf;
}

export function getSchedulePerformance(scheduleId: string): PostPerformance | null {
  return getPerformance().find((p) => p.scheduleId === scheduleId) || null;
}

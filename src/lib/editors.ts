import { isServerAvailable, apiUpsert, apiInsert, apiSetAll, apiGet } from "./data-api";

export interface EditorProfile {
  id: string;
  name: string;
  brand: string;
  initials: string;
  color: string;
  gradient: string;
  telegram: string;
  telegramId?: string;
  role: string;
  specialty: string[];
  campaignsGHS: number;
  ratePerCampaign: string;
}

export const EDITORS: EditorProfile[] = [
  {
    id: "bennyedits",
    name: "BennyEdits",
    brand: "BennyEdits",
    initials: "BE",
    color: "from-purple-600 to-pink-600",
    gradient: "from-purple-500/20 to-pink-500/20",
    telegram: "+233257806772",
    role: "Lead Editor",
    specialty: ["Dark Edit", "Cinematic", "Dance Trend"],
    campaignsGHS: 800,
    ratePerCampaign: "GHS 800",
  },
  {
    id: "sharpeditz",
    name: "SharpEditz Team",
    brand: "SharpEditz",
    initials: "SE",
    color: "from-red-600 to-orange-600",
    gradient: "from-red-500/20 to-orange-500/20",
    telegram: "@SharpEditz",
    role: "Production Team",
    specialty: ["Luxury Vibes", "Emotional", "Anime Style"],
    campaignsGHS: 600,
    ratePerCampaign: "GHS 600",
  },
  {
    id: "capcutedits",
    name: "CapCutAfrica",
    brand: "CapCutAfrica",
    initials: "CA",
    color: "from-blue-600 to-cyan-600",
    gradient: "from-blue-500/20 to-cyan-500/20",
    telegram: "@CapCutAfrica",
    role: "Template Specialist",
    specialty: ["Dance Trend", "Funny Meme Style", "Fast Edits"],
    campaignsGHS: 500,
    ratePerCampaign: "GHS 500",
  },
  {
    id: "internal-1",
    name: "Internal Editor 1",
    brand: "Internal",
    initials: "IE",
    color: "from-emerald-600 to-teal-600",
    gradient: "from-emerald-500/20 to-teal-500/20",
    telegram: "@InternalEditor1",
    role: "Junior Editor",
    specialty: ["Emotional", "Cinematic"],
    campaignsGHS: 400,
    ratePerCampaign: "GHS 400",
  },
  {
    id: "internal-2",
    name: "Internal Editor 2",
    brand: "Internal",
    initials: "I2",
    color: "from-amber-600 to-yellow-600",
    gradient: "from-amber-500/20 to-yellow-500/20",
    telegram: "@InternalEditor2",
    role: "Junior Editor",
    specialty: ["Dark Edit", "Luxury Vibes"],
    campaignsGHS: 400,
    ratePerCampaign: "GHS 400",
  },
];

export function getEditorByCampaignEditor(name: string): EditorProfile | undefined {
  return EDITORS.find(
    (e) => e.name === name || e.brand === name || name.startsWith(e.brand.split(" ")[0])
  );
}

export function getEditorById(id: string): EditorProfile | undefined {
  return EDITORS.find((e) => e.id === id);
}

export function buildTelegramDeepLink(telegram: string, message: string): string {
  const clean = telegram.replace("@", "").replace("+", "");
  const encoded = encodeURIComponent(message);
  const isPhone = /^\d+$/.test(clean);
  if (isPhone) {
    return `tg://resolve?phone=${clean}&text=${encoded}`;
  }
  return `tg://resolve?domain=${clean}&text=${encoded}`;
}

export function buildTelegramWebLink(telegram: string): string {
  const clean = telegram.replace("@", "").replace("+", "");
  const isPhone = /^\d+$/.test(clean);
  if (isPhone) {
    return `https://t.me/+${clean}`;
  }
  return `https://t.me/${clean}`;
}

export function buildTelegramMessage(
  editor: EditorProfile,
  campaign: {
    campaignId: string;
    artistName: string;
    songTitle: string;
    creativeDirection: string;
    packageName: string;
    tiktokHandle: string;
    soundOption: string;
  },
  mediaUrl?: string,
  submissionUrl?: string
): string {
  const lines = [
    `🎬 New SharpConnect Campaign Assigned`,
    ``,
    `━━━━━━━━━━━━━━━━`,
    ``,
    `Campaign: ${campaign.campaignId}`,
    `Artist: ${campaign.artistName}`,
    `Song: ${campaign.songTitle}`,
    `Package: ${campaign.packageName}`,
    `Sound: ${campaign.soundOption === "slow-reverb" ? "Slow + Reverb" : campaign.soundOption === "fast" ? "Fast Version" : "Original"}`,
    `TikTok: ${campaign.tiktokHandle}`,
    ``,
    `📝 Creative Direction`,
    campaign.creativeDirection,
  ];

  if (mediaUrl || submissionUrl) {
    lines.push(
      ``,
      `━━━━━━━━━━━━━━━━`,
    );
    if (mediaUrl) {
      lines.push(
        ``,
        `📂 Download Reference Media:`,
        mediaUrl,
      );
    }
    if (submissionUrl) {
      lines.push(
        ``,
        `📎 Submit Your Edit:`,
        submissionUrl,
      );
    }
    lines.push(
      ``,
      `Click the media link to download reference files. Use the submit link to upload your finished edit.`,
    );
  }

  lines.push(
    ``,
    `━━━━━━━━━━━━━━━━`,
    ``,
    `Please confirm receipt and start editing.`,
    `SharpConnect Admin`
  );

  return lines.join("\n");
}

// ─── ACTIVE CAMPAIGN COUNT (localStorage) ────────────────────

interface EditorAssignment {
  editorId: string;
  campaignId: string;
  assignedAt: string;
}

const ASN_KEY = "sharpconnect_assignments";

function getAssignments(): EditorAssignment[] {
  try {
    const raw = localStorage.getItem(ASN_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function assignCampaign(editorId: string, campaignId: string) {
  try {
    const all = getAssignments();
    all.unshift({ editorId, campaignId, assignedAt: new Date().toISOString() });
    localStorage.setItem(ASN_KEY, JSON.stringify(all));
    syncAssignmentsToServer(all);
  } catch (e) { console.warn("[assignCampaign] localStorage write failed:", e); }
}

async function syncAssignmentsToServer(assignments: EditorAssignment[]) {
  try { if (await isServerAvailable()) await apiSetAll("editor_assignments", assignments); } catch {}
}

export function getEditorActiveCount(editorId: string): number {
  return getAssignments().filter((a) => a.editorId === editorId).length;
}

export function getEditorAssignments(editorId: string): EditorAssignment[] {
  return getAssignments().filter((a) => a.editorId === editorId);
}

// ─── EDITOR TASK SYSTEM ──────────────────────────────────────

export interface EditorTask {
  taskId: string;
  editorId: string;
  campaignId: string;
  createdAt: string;
}

const TASKS_KEY = "sharpconnect_tasks";

function getTasks(): EditorTask[] {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function generateTaskId(): string {
  return "task_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function createEditorTask(editorId: string, campaignId: string): string {
  const tasks = getTasks();
  const existing = tasks.find((t) => t.editorId === editorId && t.campaignId === campaignId);
  if (existing) return existing.taskId;

  const task: EditorTask = {
    taskId: generateTaskId(),
    editorId,
    campaignId,
    createdAt: new Date().toISOString(),
  };
  tasks.unshift(task);
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  } catch (e) { console.warn("[createEditorTask] localStorage write failed:", e); }
  syncTasksToServer(tasks);
  return task.taskId;
}

async function syncTasksToServer(tasks: EditorTask[]) {
  try { if (await isServerAvailable()) await apiSetAll("editor_tasks", tasks); } catch {}
}

export function getTaskById(taskId: string): EditorTask | null {
  return getTasks().find((t) => t.taskId === taskId) || null;
}

export function getTaskByCampaign(campaignId: string, editorId: string): EditorTask | null {
  return getTasks().find((t) => t.campaignId === campaignId && t.editorId === editorId) || null;
}

export function getEditorTaskCount(editorId: string): number {
  return getTasks().filter((t) => t.editorId === editorId).length;
}

// ─── EDITOR SUBMISSION SYSTEM ────────────────────────────────

export interface EditorSubmissionFile {
  id: string;
  fileType: string; // "edited_video" | "completed_template" | "export_file"
  fileName: string;
  fileUrl: string;
  mimeType: string;
  uploadedAt: string;
}

export interface EditorSubmission {
  taskId: string;
  campaignId: string;
  editorId: string;
  files: EditorSubmissionFile[];
  notes: string;
  submittedAt: string;
  status: "pending" | "approved" | "needs_revision";
  adminNotes?: string;
  reviewedAt?: string;
}

const SUBMISSIONS_KEY = "sharpconnect_editor_submissions";

function getSubmissions(): EditorSubmission[] {
  try {
    const raw = localStorage.getItem(SUBMISSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveEditorSubmission(submission: EditorSubmission): boolean {
  const trySave = (submissions: EditorSubmission[]): boolean => {
    try {
      localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(submissions));
      return true;
    } catch { return false; }
  };

  const all = getSubmissions();
  const idx = all.findIndex((s) => s.taskId === submission.taskId);
  if (idx >= 0) {
    all[idx] = submission;
  } else {
    all.unshift(submission);
  }

  if (trySave(all)) {
    syncSubmissionsToServer(all);
    return true;
  }

  // Quota exceeded — prune old reviewed submissions and retry
  const kept: EditorSubmission[] = [];
  const pruned: EditorSubmission[] = [];
  for (const s of all) {
    if (s.status === "pending" || s.status === "needs_revision") {
      kept.push(s);
    } else {
      pruned.push(s);
    }
  }
  // If everything would be pruned, at least keep the current submission
  if (kept.length === 0) kept.push(submission);

  if (trySave(kept)) {
    syncSubmissionsToServer(kept);
    return true;
  }

  const minimal: EditorSubmission = { ...submission, files: [] };
  const minimalAll = getSubmissions().filter((s) => s.taskId !== submission.taskId);
  minimalAll.unshift(minimal);
  if (trySave(minimalAll)) {
    syncSubmissionsToServer(minimalAll);
    return true;
  }

  return false;
}

async function syncSubmissionsToServer(submissions: EditorSubmission[]) {
  try { if (await isServerAvailable()) await apiSetAll("editor_submissions", submissions); } catch {}
}

export function getEditorSubmission(taskId: string): EditorSubmission | null {
  return getSubmissions().find((s) => s.taskId === taskId) || null;
}

export function getCampaignSubmission(campaignId: string): EditorSubmission | null {
  return getSubmissions().find((s) => s.campaignId === campaignId) || null;
}

export function getAllPendingSubmissions(): EditorSubmission[] {
  return getSubmissions().filter((s) => s.status === "pending");
}

export function getAllReviewedSubmissions(): EditorSubmission[] {
  return getSubmissions().filter((s) => s.status === "approved" || s.status === "needs_revision");
}

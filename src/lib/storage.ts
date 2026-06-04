import { supabase, isSupabaseConfigured } from "./supabase";
import { compressFile, canCompress } from "./compress";
import { isValidFileHeader } from "./fileValidation";

export const BUCKETS = {
  AUDIO: "campaign-audio",
  REFERENCE_VIDEO: "campaign-reference-videos",
  PAYMENT_PROOF: "campaign-payment-proof",
  EDITOR_SUBMISSION: "campaign-editor-submissions",
  FINAL_APPROVED: "campaign-final-approved",
} as const;

const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024;
const TELEGRAM_BUCKETS = new Set<string>([
  BUCKETS.AUDIO,
  BUCKETS.REFERENCE_VIDEO,
  BUCKETS.PAYMENT_PROOF,
  BUCKETS.EDITOR_SUBMISSION,
  BUCKETS.FINAL_APPROVED,
]);

const MAX_FILE_SIZES: Record<string, number> = {
  [BUCKETS.AUDIO]: 20 * 1024 * 1024,
  [BUCKETS.REFERENCE_VIDEO]: 50 * 1024 * 1024,
  [BUCKETS.PAYMENT_PROOF]: 5 * 1024 * 1024,
  [BUCKETS.EDITOR_SUBMISSION]: 100 * 1024 * 1024,
  [BUCKETS.FINAL_APPROVED]: 100 * 1024 * 1024,
};

const ALLOWED_MIMES: Record<string, string[]> = {
  [BUCKETS.AUDIO]: ["audio/mpeg", "audio/wav", "audio/mp3", "audio/wave"],
  [BUCKETS.REFERENCE_VIDEO]: ["video/mp4", "video/quicktime"],
  [BUCKETS.PAYMENT_PROOF]: ["image/jpeg", "image/png", "image/webp"],
  [BUCKETS.EDITOR_SUBMISSION]: ["video/mp4", "video/quicktime", "image/jpeg", "image/png", "application/zip", "application/x-zip-compressed"],
  [BUCKETS.FINAL_APPROVED]: ["video/mp4", "video/quicktime"],
};

export interface UploadResult {
  url: string;
  path: string;
  telegramFileId?: string;
  telegramMessageId?: number;
  uploadSource: "telegram" | "supabase" | "local";
  error?: string;
}

export interface UploadRecord {
  id: string;
  campaign_id: string;
  file_type: string;
  file_name: string;
  file_url: string;
  mime_type: string;
  telegram_file_id: string;
  telegram_message_id: number | null;
  upload_source: string;
  uploaded_at: string;
}

const LS_KEY = "sharpconnect_uploads";

function lsGetAll(): UploadRecord[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function lsSave(record: UploadRecord): boolean {
  try {
    const all = lsGetAll();
    all.unshift(record);
    localStorage.setItem(LS_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

function lsGetByCampaign(campaignId: string): UploadRecord[] {
  return lsGetAll().filter((u) => u.campaign_id === campaignId);
}

const BLOCKED_EXTENSIONS = /\.(exe|bat|cmd|com|msi|scr|vbs|js|jar|py|sh|ps1|dll|sys|app|gadget|pif|msh|reg|scf)$/i;
const DOUBLE_EXTENSION = /\.(jpe?g|png|gif|webp|mp3|mp4|mov|zip|pdf|docx?)\.(exe|js|bat|sh|vbs|ps1|jar|msi)$/i;

/** Block path traversal (../) and control characters in file names. */
function sanitizeFileName(name: string): string {
  return name
    .replace(/[/\\<>:"|?*\x00-\x1f]/g, "_")
    .replace(/\.\./g, "")
    .replace(/^\.+/g, "")
    .slice(0, 255);
}

export function validateFile(file: File, bucket: string): string | null {
  if (BLOCKED_EXTENSIONS.test(file.name)) {
    return "File type not allowed.";
  }
  if (DOUBLE_EXTENSION.test(file.name)) {
    return "File type not allowed.";
  }
  const maxSize = MAX_FILE_SIZES[bucket];
  if (maxSize && file.size > maxSize) {
    const mb = maxSize / 1024 / 1024;
    return `File too large. Maximum size is ${mb}MB.`;
  }
  const allowed = ALLOWED_MIMES[bucket];
  if (allowed && !allowed.includes(file.type)) {
    return `Invalid file type.`;
  }
  return null;
}

function shouldUseTelegram(file: File, bucket: string): boolean {
  if (TELEGRAM_BUCKETS.has(bucket)) return true;
  if (file.size > LARGE_FILE_THRESHOLD) return true;
  return false;
}



function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function ensureBucket(bucket: string): Promise<boolean> {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    if (buckets?.find((b) => b.name === bucket)) return true;
    const { error } = await supabase.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: MAX_FILE_SIZES[bucket],
    });
    if (!error) return true;
    const { data: existing } = await supabase.storage.getBucket(bucket);
    return !!existing;
  } catch (e) {
    console.warn("[ensureBucket] failed:", e);
    return false;
  }
}

async function tryUploadToSupabase(
  file: File,
  bucket: string,
  filePath: string
): Promise<string | null> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
  if (error) return null;
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return urlData?.publicUrl || null;
}

async function uploadToTelegram(file: File, bucket?: string): Promise<{ fileUrl: string; fileId: string; telegramMessageId?: number } | null> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    if (bucket) formData.append("bucket", bucket);
    const res = await fetch("/api/telegram-upload", { method: "POST", body: formData });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    return { fileUrl: data.fileUrl, fileId: data.fileId, telegramMessageId: data.telegramMessageId };
  } catch (e) {
    console.error("[uploadToTelegram] failed:", e);
    return null;
  }
}

async function tryInsertUploadRecord(
  record: Pick<UploadRecord, "campaign_id" | "file_type" | "file_name" | "file_url" | "mime_type" | "telegram_file_id" | "telegram_message_id" | "upload_source">
): Promise<boolean> {
  try {
    const { error } = await supabase.from("uploads").insert({
      campaign_id: record.campaign_id,
      file_type: record.file_type,
      file_name: record.file_name || "",
      file_url: record.file_url,
      mime_type: record.mime_type || "",
      telegram_file_id: record.telegram_file_id || null,
      telegram_message_id: record.telegram_message_id || null,
      upload_source: record.upload_source || "local",
    });
    return !error;
  } catch (e) {
    console.error("[tryInsertUploadRecord] failed:", e);
    return false;
  }
}

export async function uploadFile(
  file: File,
  bucket: string,
  campaignId: string,
  type: string
): Promise<UploadResult> {
  const validationError = validateFile(file, bucket);
  if (validationError) return { url: "", path: "", error: validationError, uploadSource: "local" };

  // Magic-byte check — verify file header matches claimed MIME
  try {
    const header = await file.slice(0, 16).arrayBuffer();
    if (!isValidFileHeader(header, file.type)) {
      return { url: "", path: "", error: "File content does not match its extension.", uploadSource: "local" };
    }
  } catch {
    return { url: "", path: "", error: "Unable to verify file content. Upload aborted.", uploadSource: "local" };
  }

  const compressed = canCompress(file) ? await compressFile(file) : file;

  const ext = compressed.name.split(".").pop() || "";
  const nameBase = sanitizeFileName(compressed.name.replace(`.${ext}`, ""));
  const timestamp = Date.now();
  const filePath = `${campaignId}/${type}/${timestamp}_${nameBase}.${ext}`;

  let publicUrl = "";
  let telegramFileId = "";
  let telegramMessageId: number | null = null;
  let uploadSource: UploadResult["uploadSource"] = "local";
  let supabaseSuccess = false;

  const useTelegram = shouldUseTelegram(compressed, bucket);

  if (useTelegram) {
    const tgResult = await uploadToTelegram(compressed, bucket);
    if (tgResult) {
      publicUrl = tgResult.fileUrl;
      telegramFileId = tgResult.fileId;
      telegramMessageId = tgResult.telegramMessageId ?? null;
      uploadSource = "telegram";
    }
  }

  if (!publicUrl && isSupabaseConfigured) {
    await ensureBucket(bucket);
    const url = await tryUploadToSupabase(compressed, bucket, filePath);
    if (url) {
      publicUrl = url;
      uploadSource = "supabase";
      supabaseSuccess = true;
    }
  }

  if (!publicUrl) {
    if (compressed.size > 1024 * 1024) {
      return {
        url: "", path: "",
        error: `File too large (${(compressed.size / 1024 / 1024).toFixed(1)}MB). Please configure Telegram bot tokens in .env.local for large file uploads.`,
        uploadSource: "local",
      };
    }
    publicUrl = await fileToDataUrl(compressed);
  }

  const record: UploadRecord = {
    id: generateId(),
    campaign_id: campaignId,
    file_type: type,
    file_name: compressed.name,
    file_url: publicUrl,
    mime_type: compressed.type,
    telegram_file_id: telegramFileId,
    telegram_message_id: telegramMessageId,
    upload_source: uploadSource,
    uploaded_at: new Date().toISOString(),
  };

  if (publicUrl.length > 2_000_000 && !isSupabaseConfigured && !telegramFileId) {
    return { url: "", path: "", error: "File too large for local storage. Configure Telegram bot tokens or Supabase.", uploadSource: "local" };
  }

  const saved = lsSave(record);
  if (!saved && !supabaseSuccess && !telegramFileId) {
    return { url: "", path: "", error: "Storage quota exceeded. Try a smaller file or configure external storage.", uploadSource: "local" };
  }

  if (supabaseSuccess || telegramFileId) {
    await tryInsertUploadRecord({
      campaign_id: record.campaign_id,
      file_type: record.file_type,
      file_name: record.file_name,
      file_url: record.file_url,
      mime_type: record.mime_type,
      telegram_file_id: record.telegram_file_id,
      telegram_message_id: record.telegram_message_id,
      upload_source: record.upload_source,
    });
  }

  return {
    url: publicUrl,
    path: filePath,
    telegramFileId,
    telegramMessageId: telegramMessageId ?? undefined,
    uploadSource,
  };
}

export async function getCampaignUploads(campaignId: string): Promise<UploadRecord[]> {
  const local = lsGetByCampaign(campaignId);

  if (!isSupabaseConfigured) return local;

  const { data, error } = await supabase
    .from("uploads")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("uploaded_at", { ascending: false });

  if (error || !data) return local;

  const seen = new Set(data.map((r: any) => r.file_url));
  const extra = local.filter((r) => !seen.has(r.file_url));

  return [
    ...data.map((r: any) => ({
      id: r.id,
      campaign_id: r.campaign_id,
      file_type: r.file_type,
      file_name: r.file_name || "",
      file_url: r.file_url,
      mime_type: r.mime_type || "",
      telegram_file_id: r.telegram_file_id || "",
      telegram_message_id: r.telegram_message_id ?? null,
      upload_source: r.upload_source || "supabase",
      uploaded_at: r.uploaded_at,
    })),
    ...extra,
  ];
}

export async function deleteUpload(
  uploadId: string,
  filePath: string,
  bucket: string
): Promise<boolean> {
  if (isSupabaseConfigured) {
    try { await supabase.storage.from(bucket).remove([filePath]); } catch (e) { console.warn("[deleteUpload] storage remove failed:", e); }
    try { await supabase.from("uploads").delete().eq("id", uploadId); } catch (e) { console.warn("[deleteUpload] DB delete failed:", e); }
  }
  const all = lsGetAll();
  localStorage.setItem(LS_KEY, JSON.stringify(all.filter((u) => u.id !== uploadId)));
  return true;
}

async function uploadFileWithRetry(
  file: File,
  bucket: string,
  campaignId: string,
  type: string,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  onProgress?.(10);
  let result = await uploadFile(file, bucket, campaignId, type);
  if (result.error && shouldUseTelegram(file, bucket) && result.uploadSource !== "telegram") {
    onProgress?.(30);
    result = await uploadFile(file, bucket, campaignId, type);
  }
  if (!result.error) onProgress?.(100);
  return result;
}

export async function uploadCampaignFiles(
  campaignId: string,
  files: {
    audio?: File | null;
    referenceVideo?: File | null;
  },
  onProgress?: (type: string, percent: number) => void
): Promise<{
  audioUrl?: string;
  videoUrl?: string;
  errors: string[];
}> {
  const errors: string[] = [];
  let audioUrl: string | undefined;
  let videoUrl: string | undefined;

  if (files.audio) {
    onProgress?.("audio", 10);
    const result = await uploadFileWithRetry(files.audio, BUCKETS.AUDIO, campaignId, "audio", (p) => onProgress?.("audio", p));
    if (result.error) errors.push(`Audio: ${result.error}`);
    else {
      audioUrl = result.url;
      onProgress?.("audio", 100);
    }
  }
  if (files.referenceVideo) {
    onProgress?.("video", 10);
    const result = await uploadFileWithRetry(files.referenceVideo, BUCKETS.REFERENCE_VIDEO, campaignId, "reference_video", (p) => onProgress?.("video", p));
    if (result.error) errors.push(`Video: ${result.error}`);
    else {
      videoUrl = result.url;
      onProgress?.("video", 100);
    }
  }

  return { audioUrl, videoUrl, errors };
}

export async function uploadPaymentProofs(
  campaignId: string,
  files: {
    proof?: File | null;
    receipt?: File | null;
  },
  onProgress?: (type: string, percent: number) => void
): Promise<{
  proofUrl?: string;
  receiptUrl?: string;
  errors: string[];
}> {
  const errors: string[] = [];
  let proofUrl: string | undefined;
  let receiptUrl: string | undefined;

  if (files.proof) {
    onProgress?.("proof", 10);
    const result = await uploadFileWithRetry(files.proof, BUCKETS.PAYMENT_PROOF, campaignId, "payment_proof", (p) => onProgress?.("proof", p));
    if (result.error) errors.push(`Proof: ${result.error}`);
    else {
      proofUrl = result.url;
      onProgress?.("proof", 100);
    }
  }
  if (files.receipt) {
    onProgress?.("receipt", 10);
    const result = await uploadFileWithRetry(files.receipt, BUCKETS.PAYMENT_PROOF, campaignId, "payment_receipt", (p) => onProgress?.("receipt", p));
    if (result.error) errors.push(`Receipt: ${result.error}`);
    else {
      receiptUrl = result.url;
      onProgress?.("receipt", 100);
    }
  }

  return { proofUrl, receiptUrl, errors };
}

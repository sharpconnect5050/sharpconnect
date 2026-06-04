import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-security";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_STORAGE_CHAT_ID;

const BUCKET_SIZE_LIMITS: Record<string, number> = {
  "campaign-audio": 20 * 1024 * 1024,
  "campaign-reference-videos": 50 * 1024 * 1024,
  "campaign-payment-proof": 5 * 1024 * 1024,
  "campaign-editor-submissions": 100 * 1024 * 1024,
  "campaign-final-approved": 100 * 1024 * 1024,
};
const GLOBAL_MAX = 100 * 1024 * 1024;

const ALLOWED_MIMES_GLOBAL = new Set([
  "audio/mpeg", "audio/wav", "audio/mp3", "audio/wave",
  "video/mp4", "video/quicktime",
  "image/jpeg", "image/png", "image/webp",
  "application/zip", "application/x-zip-compressed",
]);

const BUCKET_MIMES: Record<string, Set<string>> = {
  "campaign-audio": new Set(["audio/mpeg", "audio/wav", "audio/mp3", "audio/wave", "video/mp4"]),
  "campaign-reference-videos": new Set(["video/mp4", "video/quicktime"]),
  "campaign-payment-proof": new Set(["image/jpeg", "image/png", "image/webp"]),
  "campaign-editor-submissions": new Set(["video/mp4", "video/quicktime", "image/jpeg", "image/png", "application/zip", "application/x-zip-compressed"]),
  "campaign-final-approved": new Set(["video/mp4", "video/quicktime"]),
};

const BLOCKED_EXT = /\.(exe|bat|cmd|com|msi|scr|vbs|js|jar|py|sh|ps1|dll|sys|app|gadget|pif|msh|reg|scf)$/i;
const DOUBLE_EXT = /\.(jpe?g|png|gif|webp|mp3|mp4|mov|zip|pdf|docx?)\.(exe|js|bat|sh|vbs|ps1|jar|msi)$/i;

const MAX_FILES_PER_REQUEST = 5;
const ALLOWED_BUCKETS = new Set(Object.keys(BUCKET_SIZE_LIMITS));

function sanitizeName(name: string): string {
  return name
    .replace(/[/\\<>:"|?*\x00-\x1f]/g, "_")
    .replace(/\.\./g, "")
    .replace(/^\.+/g, "")
    .slice(0, 255);
}

export async function POST(request: NextRequest) {
  return apiHandler(request, async () => {
    if (!BOT_TOKEN || !CHAT_ID) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
    }

    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 110 * 1024 * 1024) {
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    }

    const formData = await request.formData();
    const bucket = (formData.get("bucket") as string) || "";
    if (bucket && !ALLOWED_BUCKETS.has(bucket)) {
      return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
    }
    const files: File[] = [];
    for (const [, val] of formData.entries()) {
      if (val instanceof File) files.push(val);
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (files.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json({ error: "Too many files" }, { status: 400 });
    }

    const file = files[0];

    const maxSize = (bucket && BUCKET_SIZE_LIMITS[bucket]) || GLOBAL_MAX;
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File too large" }, { status: 400 });
    }

    const allowedMimes = (bucket && BUCKET_MIMES[bucket]) || ALLOWED_MIMES_GLOBAL;
    if (!allowedMimes.has(file.type)) {
      return NextResponse.json({ error: "File type not allowed for this bucket" }, { status: 400 });
    }
    if (BLOCKED_EXT.test(file.name) || DOUBLE_EXT.test(file.name)) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
    }

    const safeName = sanitizeName(file.name);

    const apiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`;
    const tgForm = new FormData();
    tgForm.append("chat_id", CHAT_ID);
    tgForm.append("document", file, safeName);

    const res = await fetch(apiUrl, { method: "POST", body: tgForm });
    const data = await res.json();

    if (!data.ok) {
      return NextResponse.json({ error: "Upload failed" }, { status: 502 });
    }

    const msg = data.result;
    const fileId = msg.document?.file_id || msg.video?.file_id || msg.audio?.file_id || msg.photo?.[0]?.file_id || "";
    const messageId = msg.message_id;

    if (!fileId) {
      return NextResponse.json({ error: "Upload verification failed" }, { status: 502 });
    }

    const verifyRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
    const verifyData = await verifyRes.json();
    if (!verifyData.ok || !verifyData.result?.file_path) {
      return NextResponse.json({ error: "Upload verification failed" }, { status: 502 });
    }

    return NextResponse.json({
      fileId,
      fileUrl: `/api/media/${fileId}`,
      fileName: safeName,
      telegramMessageId: messageId,
    });
  }, "telegram");
}

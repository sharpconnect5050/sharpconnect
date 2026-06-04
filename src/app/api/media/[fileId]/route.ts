import { NextRequest, NextResponse } from "next/server";
import { apiHandler, addSecurityHeaders } from "@/lib/api-security";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const INLINE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "audio/mpeg"]);

function inferMimeType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    webp: "image/webp", gif: "image/gif", mp4: "video/mp4",
    mov: "video/quicktime", mp3: "audio/mpeg", wav: "audio/wav",
    zip: "application/zip", pdf: "application/pdf",
  };
  return map[ext] || "application/octet-stream";
}

function sanitizeName(name: string): string {
  return name.replace(/[/\\<>:"|?*\x00-\x1f]/g, "_").slice(0, 255);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  return apiHandler(request, async () => {
    const { fileId } = await params;

    if (!BOT_TOKEN) {
      return addSecurityHeaders(new NextResponse("Storage not configured", { status: 500 }));
    }

    if (!fileId || fileId.length > 200 || /[^\w\-]/.test(fileId)) {
      return addSecurityHeaders(new NextResponse("Invalid file ID", { status: 400 }));
    }

    const fileRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`
    );
    const fileData = await fileRes.json();
    if (!fileData.ok || !fileData.result?.file_path) {
      return addSecurityHeaders(new NextResponse("File not found", { status: 404 }));
    }

    const tgFilePath = fileData.result.file_path;
    const tgUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${tgFilePath}`;

    const response = await fetch(tgUrl);
    if (!response.ok) {
      return addSecurityHeaders(new NextResponse("Failed to fetch file", { status: 502 }));
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 110 * 1024 * 1024) {
      return addSecurityHeaders(new NextResponse("File too large", { status: 413 }));
    }

    const mimeType = inferMimeType(tgFilePath);
    const fileName = sanitizeName(tgFilePath.split("/").pop() || "file");

    const headers = new Headers(response.headers);
    headers.set("Content-Type", mimeType);
    headers.set("Cache-Control", "public, max-age=3600");
    headers.set("X-Content-Type-Options", "nosniff");

    if (IMAGE_TYPES.has(mimeType)) {
      headers.set("Content-Disposition", `inline; filename="${fileName}"`);
    } else {
      headers.set("Content-Disposition", `attachment; filename="${fileName}"`);
    }

    // Strip any content-encoding Telegram may have set
    headers.delete("content-encoding");
    headers.delete("transfer-encoding");

    return new NextResponse(response.body, { status: 200, headers });
  }, "default");
}

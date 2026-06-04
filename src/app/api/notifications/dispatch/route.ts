import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireJson, safeParseJson, apiHandler, limitBodySize, sanitizeText } from "@/lib/api-security";
import { dispatchToTelegram, logDispatch, getAdminTelegramChatId } from "@/lib/notification-dispatch";
import { dispatchToEmail } from "@/lib/email-dispatch";
import type { AppNotification } from "@/lib/notifications";

export async function POST(request: NextRequest) {
  return apiHandler(request, async () => {
    const auth = requireRole(request, "super_admin", "admin");
    if (auth instanceof NextResponse) return auth;
    const size = await limitBodySize(request);
    if (size instanceof NextResponse) return size;

    const json = requireJson(request);
    if (json instanceof NextResponse) return json;

    const body = await safeParseJson(request);
    if (body instanceof NextResponse) return body;

    const notification = body as unknown as AppNotification;
    if (typeof notification.type !== "string" || !notification.type) {
      return NextResponse.json({ error: "Missing required field: type" }, { status: 400 });
    }
    if (typeof notification.title !== "string" || !notification.title) {
      return NextResponse.json({ error: "Missing required field: title" }, { status: 400 });
    }
    notification.title = sanitizeText(notification.title, 200);
    if (notification.message) notification.message = sanitizeText(notification.message, 2000);

    const results: Record<string, unknown>[] = [];

    const adminChatId = getAdminTelegramChatId();
    if (adminChatId) {
      const r = await dispatchToTelegram(notification, adminChatId);
      results.push({ ...r });
      await logDispatch(r, notification);
    }

    if (notification.campaignId) {
      const storageChatId = process.env.TELEGRAM_STORAGE_CHAT_ID;
      if (storageChatId && storageChatId !== adminChatId) {
        const r = await dispatchToTelegram(notification, storageChatId);
        results.push({ ...r });
        await logDispatch(r, notification);
      }
    }

    const adminEmail = process.env.SMTP_ADMIN_TO || process.env.SMTP_USER || "sharpconnectinfo@gmail.com";
    if (adminEmail) {
      const emailResult = await dispatchToEmail(notification, adminEmail);
      results.push({ ...emailResult });
      await logDispatch(emailResult, notification);
    }

    return NextResponse.json({
      dispatched: results.length,
      results,
    });
  }, "default");
}

import { NextRequest, NextResponse } from "next/server";
import { logEvent, getEventLogs, type EventType } from "@/lib/events";
import { requireRole, requireJson, safeParseJson, requireString, apiHandler, addCacheHeader, limitBodySize, sanitizeText } from "@/lib/api-security";

export async function POST(request: NextRequest) {
  return apiHandler(request, async () => {
    const size = await limitBodySize(request);
    if (size instanceof NextResponse) return size;
    const auth = requireRole(request, "super_admin", "admin");
    if (auth instanceof NextResponse) return auth;
    const json = requireJson(request);
    if (json instanceof NextResponse) return json;

    const body = await safeParseJson(request);
    if (body instanceof NextResponse) return body;

    const campaignId = requireString(body.campaignId, "campaignId");
    if (campaignId instanceof NextResponse) return campaignId;

    const type = requireString(body.type, "type");
    if (type instanceof NextResponse) return type;

    const metadata: Record<string, string> = {};
    if (typeof body.metadata === "object" && body.metadata) {
      for (const [k, v] of Object.entries(body.metadata as Record<string, unknown>)) {
        if (typeof k === "string" && k.length <= 100 && (typeof v === "string" || typeof v === "number" || typeof v === "boolean")) {
          metadata[sanitizeText(k, 100)] = sanitizeText(String(v), 1000);
        }
      }
    }
    const event = await logEvent(campaignId, type as EventType, metadata);
    return NextResponse.json({ success: true, event });
  }, "events");
}

export async function GET(request: NextRequest) {
  return apiHandler(request, async () => {
    const size = await limitBodySize(request);
    if (size instanceof NextResponse) return size;
    const auth = requireRole(request, "super_admin", "admin", "viewer");
    if (auth instanceof NextResponse) return auth;
    const limit = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get("limit") || "200", 10) || 200, 1), 1000);
    const events = await getEventLogs(limit);
    return addCacheHeader(NextResponse.json(events));
  }, "events");
}

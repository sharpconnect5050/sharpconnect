import { NextRequest, NextResponse } from "next/server";
import { serverStoreToken } from "@/lib/server-token-store";
import { requireRole, apiHandler, requireJson, safeParseJson, limitBodySize, requireString } from "@/lib/api-security";

export async function POST(req: NextRequest) {
  return apiHandler(req, async () => {
    const auth = requireRole(req, "super_admin", "admin");
    if (auth instanceof NextResponse) return auth;

    const size = await limitBodySize(req);
    if (size instanceof NextResponse) return size;
    const json = requireJson(req);
    if (json instanceof NextResponse) return json;
    const body = await safeParseJson(req);
    if (body instanceof NextResponse) return body;

    const campaignId = requireString(body.campaignId, "campaignId");
    if (campaignId instanceof NextResponse) return campaignId;
    if (campaignId.length > 200) {
      return NextResponse.json({ error: "Invalid campaignId" }, { status: 400 });
    }

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    let token = "";
    for (let i = 0; i < 32; i++) token += chars[bytes[i] % chars.length];

    serverStoreToken(token, campaignId);

    return NextResponse.json({ token, url: `/review/${token}` });
  }, "review");
}

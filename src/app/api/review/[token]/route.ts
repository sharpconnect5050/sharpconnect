import { NextRequest, NextResponse } from "next/server";
import { serverLookupToken, serverTouchToken } from "@/lib/server-token-store";
import { apiHandler } from "@/lib/api-security";

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return apiHandler(req, async () => {
    const { token } = await params;

    if (!token || token.length > 200) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    const entry = serverLookupToken(token);
    if (!entry) {
      return NextResponse.json({ error: "Invalid or expired review token" }, { status: 404 });
    }

    serverTouchToken(token);
    return NextResponse.json({ campaignId: entry.campaignId, token: entry.token });
  }, "review");
}

import { NextRequest, NextResponse } from "next/server";
import { requireJson, safeParseJson, requireString, apiHandler, addSecurityHeaders, limitBodySize } from "@/lib/api-security";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminToken, verifyAdminToken, lookupRole } from "@/lib/auth";

export async function POST(request: NextRequest) {
  return apiHandler(request, async () => {
    const rateCheck = checkRateLimit(request, "default");
    if (rateCheck) return addSecurityHeaders(rateCheck);
    const size = await limitBodySize(request);
    if (size instanceof NextResponse) return size;
    const json = requireJson(request);
    if (json instanceof NextResponse) return json;

    const body = await safeParseJson(request);
    if (body instanceof NextResponse) return body;

    const adminPwd = process.env.ADMIN_PASSWORD;
    if (!adminPwd) {
      return addSecurityHeaders(NextResponse.json({ valid: false }, { status: 500 }));
    }

    // If a token is provided, verify it (re-auth on page load)
    const token = typeof body.token === "string" ? body.token : "";
    if (token) {
      const payload = verifyAdminToken(token);
      return addSecurityHeaders(NextResponse.json({ valid: !!payload, role: payload?.role || null }));
    }

    // If a password is provided, check it and issue a token
    const pwd = requireString(body.pwd, "pwd");
    if (pwd instanceof NextResponse) return pwd;

    const role = lookupRole(pwd);
    if (!role) {
      return addSecurityHeaders(NextResponse.json({ valid: false }));
    }

    const newToken = createAdminToken(role);
    if (!newToken) {
      return addSecurityHeaders(NextResponse.json({ valid: false }, { status: 500 }));
    }

    return addSecurityHeaders(NextResponse.json({ valid: true, token: newToken, role }));
  });
}

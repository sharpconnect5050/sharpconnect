import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, type TokenPayload, type AdminRole } from "./auth";
import { checkRateLimit, type RateLimitScope } from "./rate-limit";

export function requireAdmin(request: NextRequest): true | NextResponse {
  const auth = request.headers.get("authorization");
  if (!auth || !verifyAdminToken(auth)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return true;
}

export function requireRole(request: NextRequest, ...allowedRoles: AdminRole[]): TokenPayload | NextResponse {
  const auth = request.headers.get("authorization");
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyAdminToken(auth);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!allowedRoles.includes(payload.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return payload;
}

export function requireJson(request: NextRequest): true | NextResponse {
  const ct = request.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 400 });
  }
  return true;
}

export async function safeParseJson(request: NextRequest): Promise<Record<string, unknown> | NextResponse> {
  try {
    return await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}

export function requireString(val: unknown, name: string): string | NextResponse {
  if (typeof val !== "string" || !val.trim()) {
    return NextResponse.json({ error: `${name} is required` }, { status: 400 });
  }
  return val.trim();
}

export function requireLength(val: string, name: string, maxLen: number): string | NextResponse {
  if (val.length > maxLen) {
    return NextResponse.json({ error: `${name} exceeds maximum length of ${maxLen}` }, { status: 400 });
  }
  return val;
}

const MAX_BODY_BYTES = 100_000;

export async function limitBodySize(request: NextRequest): Promise<true | NextResponse> {
  const clone = request.clone();
  const text = await clone.text();
  if (text.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }
  return true;
}

export function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export function addCacheHeader(response: NextResponse, maxAge = 30): NextResponse {
  if (!response.headers.get("Cache-Control")) {
    response.headers.set("Cache-Control", `private, max-age=${maxAge}`);
  }
  return response;
}

export function sanitizeText(val: string, maxLen = 5000): string {
  return val
    .replace(/\0/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/<[^>]*>/g, "")
    .trim()
    .slice(0, maxLen);
}

export function requireOrigin(request: NextRequest, ...allowedOrigins: string[]): boolean {
  const origin = request.headers.get("origin") || request.headers.get("referer") || "";
  if (!origin) return false;
  return allowedOrigins.some((a) => origin.startsWith(a));
}

export async function apiHandler(
  request: NextRequest,
  handler: () => Promise<NextResponse>,
  rateLimitScope?: RateLimitScope
): Promise<NextResponse> {
  try {
    if (rateLimitScope) {
      const rateCheck = checkRateLimit(request, rateLimitScope);
      if (rateCheck) return addSecurityHeaders(rateCheck);
    }
    return addSecurityHeaders(await handler());
  } catch {
    return addSecurityHeaders(NextResponse.json({ error: "Internal server error" }, { status: 500 }));
  }
}

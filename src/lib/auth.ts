import { createHmac } from "crypto";

export type AdminRole = "super_admin" | "admin" | "viewer";

interface AdminRoleConfig {
  role: AdminRole;
  pwd: string;
}

const TOKEN_EXPIRY_HOURS = 24;

export interface TokenPayload {
  role: AdminRole;
  iat: number;
  exp: number;
}

function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || "";
}

function loadRoleConfig(): AdminRoleConfig[] {
  const configs: AdminRoleConfig[] = [];
  const superPwd = process.env.SUPER_ADMIN_PASSWORD;
  const adminPwd = process.env.ADMIN_PASSWORD;
  const viewerPwd = process.env.VIEWER_PASSWORD;
  if (superPwd) configs.push({ role: "super_admin", pwd: superPwd });
  if (adminPwd) configs.push({ role: "admin", pwd: adminPwd });
  if (viewerPwd) configs.push({ role: "viewer", pwd: viewerPwd });
  return configs;
}

export function lookupRole(password: string): AdminRole | null {
  const configs = loadRoleConfig();
  for (const c of configs) {
    if (c.pwd === password) return c.role;
  }
  return null;
}

function b64url(input: string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): string {
  const padded = str + "=".repeat((4 - str.length % 4) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString();
}

function hmacSign(data: string): string {
  const key = getAdminPassword();
  return createHmac("sha256", key)
    .update(data)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function createAdminToken(role: AdminRole): string | null {
  const adminPwd = getAdminPassword();
  if (!adminPwd) return null;

  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    role,
    iat: now,
    exp: now + TOKEN_EXPIRY_HOURS * 3600,
  };

  const header = '{"alg":"HS256","typ":"JWT"}';
  const headerEnc = b64url(header);
  const payloadEnc = b64url(JSON.stringify(payload));
  const signature = hmacSign(`${headerEnc}.${payloadEnc}`);

  return `${headerEnc}.${payloadEnc}.${signature}`;
}

export function verifyAdminToken(token: string): TokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerEnc, payloadEnc, signature] = parts;

    const expectedSig = hmacSign(`${headerEnc}.${payloadEnc}`);
    if (signature !== expectedSig) return null;

    const payload: TokenPayload = JSON.parse(b64urlDecode(payloadEnc));
    if (!["super_admin", "admin", "viewer"].includes(payload.role)) return null;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

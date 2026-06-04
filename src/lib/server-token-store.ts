/* Server-side token store for cross-device review link sharing.
   In production this would be Supabase. For localStorage fallback, we use a JSON file. */

import * as fs from "fs";
import * as path from "path";

interface TokenEntry {
  token: string;
  campaignId: string;
  createdAt: string;
  lastAccessedAt: string;
  status: "active" | "expired";
}

const STORE_PATH = path.join(process.cwd(), ".review-tokens.json");

function readStore(): TokenEntry[] {
  try {
    if (fs.existsSync(STORE_PATH)) {
      return JSON.parse(fs.readFileSync(STORE_PATH, "utf-8"));
    }
  } catch {}
  return [];
}

function writeStore(tokens: TokenEntry[]) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(tokens, null, 2), "utf-8");
  } catch {}
}

export function serverStoreToken(token: string, campaignId: string): void {
  const tokens = readStore();
  tokens.push({
    token,
    campaignId,
    createdAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    status: "active",
  });
  writeStore(tokens);
}

export function serverLookupToken(token: string): TokenEntry | null {
  return readStore().find((t) => t.token === token && t.status === "active") || null;
}

export function serverTouchToken(token: string): void {
  const tokens = readStore();
  const found = tokens.find((t) => t.token === token);
  if (found) {
    found.lastAccessedAt = new Date().toISOString();
    writeStore(tokens);
  }
}

const MISSING: string[] = [];

function req(name: string, value: string | undefined, publicVar = false): string {
  if (!value || value.startsWith("your-") || value.startsWith("change-me")) {
    if (typeof window === "undefined") MISSING.push(name);
    return "";
  }
  return value;
}

// Client-safe (NEXT_PUBLIC_*) — bundled in client but meant to be public
export const NEXT_PUBLIC_SUPABASE_URL = req("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL, true);
export const NEXT_PUBLIC_SUPABASE_ANON_KEY = req("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, true);

// Server-only — never exposed to client bundle
export const TELEGRAM_BOT_TOKEN = req("TELEGRAM_BOT_TOKEN", process.env.TELEGRAM_BOT_TOKEN);
export const TELEGRAM_STORAGE_CHAT_ID = req("TELEGRAM_STORAGE_CHAT_ID", process.env.TELEGRAM_STORAGE_CHAT_ID);
export const ADMIN_PASSWORD = req("ADMIN_PASSWORD", process.env.ADMIN_PASSWORD);
export const GEMINI_API_KEY = req("GEMINI_API_KEY", process.env.GEMINI_API_KEY);
export const SUPABASE_SERVICE_ROLE_KEY = req("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);

// Email SMTP Configuration
export const SMTP_HOST = req("SMTP_HOST", process.env.SMTP_HOST || "smtp.gmail.com");
export const SMTP_PORT = process.env.SMTP_PORT || "587";
export const SMTP_USER = req("SMTP_USER", process.env.SMTP_USER || "sharpconnectinfo@gmail.com");
export const SMTP_PASS = req("SMTP_PASS", process.env.SMTP_PASS);
export const SMTP_FROM = process.env.SMTP_FROM || "sharpconnectinfo@gmail.com";
export const SMTP_ADMIN_TO = process.env.SMTP_ADMIN_TO || "sharpconnectinfo@gmail.com";

let logged = false;

/** Call once at server startup to log missing required env vars. */
export function validateEnv() {
  if (logged || typeof window !== "undefined") return;
  logged = true;
  if (process.env.NEXT_PUBLIC_TEST_MODE === "true") {
    console.info("[env] Local test mode active — external services are DISABLED");
    return;
  }
  if (MISSING.length > 0) {
    console.warn(`[env] Missing or placeholder env vars: ${MISSING.join(", ")}`);
    console.warn(`[env] Some features will be disabled until these are set in .env.local`);
  }
}

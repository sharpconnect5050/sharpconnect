import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("your-project"));

function getUrl() {
  return supabaseUrl || "https://placeholder.supabase.co";
}

function getKey() {
  return supabaseAnonKey || "placeholder-key";
}

export const supabase = createClient(getUrl(), getKey(), {
  auth: { persistSession: true },
  db: { schema: "public" },
});

/** Server-side client with service_role key — only use in API routes, never expose to client. */
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || !isSupabaseConfigured) return null;
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
    db: { schema: "public" },
  });
}

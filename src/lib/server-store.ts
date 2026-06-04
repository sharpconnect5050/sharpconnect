import { createAdminClient } from "./supabase";

const ALLOWED_COLLECTIONS = [
  "campaigns", "editor_submissions", "editor_tasks", "editor_assignments",
  "schedules", "schedule_tasks", "review_history", "review_tokens",
  "artist_reviews", "review_comments", "event_logs", "notifications",
  "activity_log", "post_performance",
] as const;

function getClient() {
  const client = createAdminClient();
  if (!client) throw new Error("Supabase admin client not configured — set SUPABASE_SERVICE_ROLE_KEY");
  return client;
}

export async function getAll<T = any>(collection: string): Promise<T[]> {
  if (!ALLOWED_COLLECTIONS.includes(collection as any)) return [];
  const { data, error } = await getClient()
    .from("app_data")
    .select("data")
    .eq("collection", collection)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((r: any) => r.data as T);
}

export async function getById<T = any>(collection: string, id: string): Promise<T | null> {
  if (!ALLOWED_COLLECTIONS.includes(collection as any)) return null;
  const { data, error } = await getClient()
    .from("app_data")
    .select("data")
    .eq("collection", collection)
    .eq("id", id)
    .single();
  if (error) return null;
  return data?.data as T ?? null;
}

export async function query<T = any>(collection: string, key: string, value: string): Promise<T[]> {
  if (!ALLOWED_COLLECTIONS.includes(collection as any)) return [];
  const { data, error } = await getClient()
    .from("app_data")
    .select("data")
    .eq("collection", collection);
  if (error) throw error;
  const results = (data || []).map((r: any) => r.data as T);
  return results.filter((item: any) => String(item[key] ?? "") === value);
}

export async function insert<T extends { id: string }>(collection: string, item: T): Promise<T> {
  if (!ALLOWED_COLLECTIONS.includes(collection as any)) throw new Error("Invalid collection");
  const { error } = await getClient()
    .from("app_data")
    .insert({ collection, id: item.id, data: item, updated_at: new Date().toISOString() });
  if (error) throw error;
  return item;
}

export async function update<T extends { id: string }>(collection: string, id: string, updates: Partial<T>): Promise<T | null> {
  if (!ALLOWED_COLLECTIONS.includes(collection as any)) throw new Error("Invalid collection");
  const existing = await getById<T>(collection, id);
  if (!existing) return null;
  const merged = { ...existing, ...updates };
  const { error } = await getClient()
    .from("app_data")
    .update({ data: merged, updated_at: new Date().toISOString() })
    .eq("collection", collection)
    .eq("id", id);
  if (error) throw error;
  return merged;
}

export async function upsert<T extends { id: string }>(collection: string, item: T): Promise<T> {
  if (!ALLOWED_COLLECTIONS.includes(collection as any)) throw new Error("Invalid collection");
  const { error } = await getClient()
    .from("app_data")
    .upsert(
      { collection, id: item.id, data: item, updated_at: new Date().toISOString() },
      { onConflict: "collection, id", ignoreDuplicates: false }
    );
  if (error) throw error;
  return item;
}

export async function remove(collection: string, id: string): Promise<boolean> {
  if (!ALLOWED_COLLECTIONS.includes(collection as any)) return false;
  const { error, count } = await getClient()
    .from("app_data")
    .delete({ count: "exact" })
    .eq("collection", collection)
    .eq("id", id);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function setAll<T>(collection: string, items: T[]): Promise<void> {
  if (!ALLOWED_COLLECTIONS.includes(collection as any)) throw new Error("Invalid collection");
  const supabase = getClient();
  const { error: delErr } = await supabase.from("app_data").delete().eq("collection", collection);
  if (delErr) throw delErr;
  if (items.length === 0) return;
  const rows = items.map((item: any) => ({
    collection,
    id: item.id,
    data: item,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from("app_data").insert(rows);
  if (error) throw error;
}

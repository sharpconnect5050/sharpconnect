import { NextRequest, NextResponse } from "next/server";
import * as store from "@/lib/server-store";

const ALLOWED_COLLECTIONS = [
  "campaigns", "editor_submissions", "editor_tasks", "editor_assignments",
  "schedules", "schedule_tasks", "review_history", "review_tokens",
  "artist_reviews", "review_comments", "event_logs", "notifications",
  "activity_log", "post_performance",
];

export async function GET(request: NextRequest, { params }: { params: Promise<{ collection: string }> }) {
  const { collection } = await params;
  if (!ALLOWED_COLLECTIONS.includes(collection)) {
    return NextResponse.json({ error: "Invalid collection" }, { status: 400 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const key = url.searchParams.get("key");
  const value = url.searchParams.get("value");

  try {
    if (id) {
      const item = await store.getById(collection, id);
      return NextResponse.json(item);
    }
    if (key && value) {
      const results = await store.query(collection, key, value);
      return NextResponse.json(results);
    }
    const all = await store.getAll(collection);
    return NextResponse.json(all);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ collection: string }> }) {
  const { collection } = await params;
  if (!ALLOWED_COLLECTIONS.includes(collection)) {
    return NextResponse.json({ error: "Invalid collection" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { action, data, id } = body;

    switch (action) {
      case "upsert":
        return NextResponse.json(await store.upsert(collection, data));
      case "insert":
        return NextResponse.json(await store.insert(collection, data));
      case "update":
        return NextResponse.json(await store.update(collection, id, data));
      case "delete":
        return NextResponse.json({ deleted: await store.remove(collection, id) });
      case "setAll":
        await store.setAll(collection, data);
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { requireRole, apiHandler, sanitizeText } from "@/lib/api-security";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  return apiHandler(req, async () => {
    const auth = requireRole(req, "super_admin", "admin", "viewer");
    if (auth instanceof NextResponse) return auth;

    const { campaignId } = await params;
    if (!campaignId || campaignId.length > 200) {
      return NextResponse.json({ error: "Invalid campaignId" }, { status: 400 });
    }

    const url = new URL(req.url);
    const page = Math.max(0, parseInt(url.searchParams.get("page") || "0", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "25", 10)));
    const category = url.searchParams.get("category") ? sanitizeText(url.searchParams.get("category")!, 100) : null;

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    let query = admin
      .from("activity_logs")
      .select("*", { count: "exact" })
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false });

    if (category) {
      query = query.eq("category", category);
    }

    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await query.range(from, to);

    if (error) throw error;

    const entries = (data || []).map((row: any) => ({
      id: row.id,
      campaignId: row.campaign_id,
      type: row.type,
      category: row.category,
      actor: row.actor,
      actorRole: row.actor_role,
      title: row.title,
      description: row.description,
      metadata: row.metadata || {},
      timestamp: row.created_at,
      version: row.version || undefined,
    }));

    return NextResponse.json({
      entries,
      total: count || 0,
      page,
      pageSize,
      hasMore: (count || 0) > from + pageSize,
    });
  }, "events");
}

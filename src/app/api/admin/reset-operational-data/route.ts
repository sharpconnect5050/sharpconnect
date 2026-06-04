import { NextRequest, NextResponse } from "next/server";
import { requireRole, apiHandler } from "@/lib/api-security";
import { createAdminClient } from "@/lib/supabase";

const OPERATIONAL_TABLES = [
  "notification_logs",
  "event_logs",
  "artist_notifications",
  "admin_alerts",
  "activity_logs",
  "uploads",
  "payments",
  "notifications",
  "automation_settings",
  "campaigns",
] as const;

export async function POST(request: NextRequest) {
  return apiHandler(request, async () => {
    const auth = requireRole(request, "super_admin", "admin");
    if (auth instanceof NextResponse) return auth;

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Admin client unavailable — SUPABASE_SERVICE_ROLE_KEY not configured" },
        { status: 503 },
      );
    }

    const results: Record<string, { deleted: number; ok: boolean }> = {};
    let allOk = true;
    const errors: string[] = [];

    for (const table of OPERATIONAL_TABLES) {
      const { data, error } = await admin.rpc("delete_all_rows", { tname: table });

      if (error) {
        results[table] = { deleted: -1, ok: false };
        errors.push(table);
        allOk = false;
      } else {
        results[table] = { deleted: (data as number) ?? 0, ok: true };
      }
    }

    if (!allOk) {
      return NextResponse.json({
        success: false,
        results,
        errors,
        note: "Some tables could not be cleared.",
      }, { status: 500 });
    }

    const total = Object.values(results).reduce((s, r) => s + r.deleted, 0);

    return NextResponse.json({
      success: true,
      results,
      totalDeleted: total,
      note: "All operational data cleared. Schema, integrations, and configuration preserved.",
    });
  }, "default");
}

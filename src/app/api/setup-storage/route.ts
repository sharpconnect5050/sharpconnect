import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured, createAdminClient } from "@/lib/supabase";
import { requireRole, apiHandler, addSecurityHeaders } from "@/lib/api-security";

const BUCKETS = [
  { name: "campaign-audio", public: true, maxSize: 15728640 },
  { name: "campaign-reference-videos", public: true, maxSize: 52428800 },
  { name: "campaign-payment-proof", public: true, maxSize: 5242880 },
  { name: "campaign-editor-submissions", public: true, maxSize: 104857600 },
  { name: "campaign-final-approved", public: true, maxSize: 104857600 },
];

export async function POST(request: NextRequest) {
  return apiHandler(request, async () => {
    const auth = requireRole(request, "super_admin");
    if (auth instanceof NextResponse) return auth;

    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return addSecurityHeaders(NextResponse.json({ error: "Service role key not configured" }, { status: 500 }));
    }

    const results: { bucket: string; created: boolean }[] = [];

    for (const bucket of BUCKETS) {
      const { data: existing } = await admin.storage.getBucket(bucket.name);
      if (existing) {
        results.push({ bucket: bucket.name, created: true });
        continue;
      }
      const { error } = await admin.storage.createBucket(bucket.name, {
        public: bucket.public,
        fileSizeLimit: bucket.maxSize,
      });
      results.push({ bucket: bucket.name, created: !error });
    }

    const allCreated = results.every((r) => r.created);
    return NextResponse.json({ success: allCreated, results });
  }, "default");
}

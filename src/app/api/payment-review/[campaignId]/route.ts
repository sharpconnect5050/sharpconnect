import { NextRequest, NextResponse } from "next/server";
import { updateCampaign, getCampaigns } from "@/lib/adminData";
import { logEvent } from "@/lib/events";
import { runPaymentApprovedWorkflow, runPaymentRejectedWorkflow } from "@/lib/workflows";
import { requireRole, requireJson, safeParseJson, requireString, apiHandler, limitBodySize, sanitizeText } from "@/lib/api-security";

const VALID_ACTIONS = ["approve", "reject", "request-new-proof"] as const;
type ValidAction = typeof VALID_ACTIONS[number];
function isValidAction(v: string): v is ValidAction {
  return VALID_ACTIONS.includes(v as any);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  return apiHandler(request, async () => {
    const auth = requireRole(request, "super_admin", "admin");
    if (auth instanceof NextResponse) return auth;

    const { campaignId } = await params;
    if (!campaignId || campaignId.length > 200) {
      return NextResponse.json({ error: "Invalid campaign ID" }, { status: 400 });
    }

    const size = await limitBodySize(request);
    if (size instanceof NextResponse) return size;
    const json = requireJson(request);
    if (json instanceof NextResponse) return json;

    const body = await safeParseJson(request);
    if (body instanceof NextResponse) return body;

    const action = requireString(body.action, "action");
    if (action instanceof NextResponse) return action;
    if (!isValidAction(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const reason = sanitizeText(typeof body.reason === "string" ? body.reason : "", 500);
    const notes = sanitizeText(typeof body.notes === "string" ? body.notes : "", 2000);

    if (action === "approve") {
      await runPaymentApprovedWorkflow(campaignId);
      return NextResponse.json({ success: true, status: "Paid" });
    }

    if (action === "reject") {
      await updateCampaign(campaignId, { status: "Rejected" });
      await logEvent(campaignId, "payment_rejected", { status: "rejected", reason: reason || "No reason provided" });
      await runPaymentRejectedWorkflow(campaignId);
      return NextResponse.json({ success: true, status: "Rejected" });
    }

    if (action === "request-new-proof") {
      const campaigns = await getCampaigns();
      const campaign = campaigns.find((c) => c.campaignId === campaignId);
      const existingNotes = campaign?.notes || "";
      const proofNote = `[Proof Requested ${new Date().toISOString().split("T")[0]}] ${notes || "Please upload a new payment proof."}`;
      const updatedNotes = existingNotes ? `${existingNotes}\n${proofNote}` : proofNote;
      await updateCampaign(campaignId, { notes: updatedNotes });
      await logEvent(campaignId, "proof_requested", { notes: notes || "" });
      return NextResponse.json({ success: true, status: "pending", message: proofNote });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }, "default");
}

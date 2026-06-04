import { NextRequest, NextResponse } from "next/server";
import { getCampaign } from "@/lib/adminData";
import { apiHandler, addCacheHeader } from "@/lib/api-security";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return apiHandler(request, async () => {
    const { id } = await params;
    if (!id || id.length > 200) {
      return NextResponse.json({ error: "Invalid campaign ID" }, { status: 400 });
    }
    const campaign = await getCampaign(id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    return addCacheHeader(NextResponse.json({
      campaignId: campaign.campaignId,
      status: campaign.status,
      artistName: campaign.artistName,
      songTitle: campaign.songTitle,
      packageName: campaign.packageName,
      total: campaign.total,
      soundOption: campaign.soundOption,
      creativeDirection: campaign.creativeDirection,
      selectedTags: campaign.selectedTags,
      hasAudio: campaign.hasAudio,
      hasVideo: campaign.hasVideo,
      notes: campaign.notes,
      editor: campaign.editor,
      priority: campaign.priority,
      audioUrl: campaign.audioUrl,
      videoUrl: campaign.videoUrl,
      tiktokSoundLink: campaign.tiktokSoundLink,
    }));
  }, "track");
}

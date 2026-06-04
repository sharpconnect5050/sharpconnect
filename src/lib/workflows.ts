import { logEvent, logError } from "./events";
import {
  addPaymentApprovedNotification,
  addCampaignStartedNotification,
  addCampaignCompletedNotification,
  addAdminNotification,
  addEditorAssignedNotification,
  addWorkflowErrorNotification,
} from "./notifications";
import { getCampaigns, updateCampaign, type Campaign, type CampaignStatus } from "./adminData";
import { addArtistNotification } from "@/lib/artistNotifications";
import { supabase, isSupabaseConfigured } from "./supabase";

const editors = ["BennyEdits", "SharpEditz Team", "Internal Editor 1", "Internal Editor 2"];

interface AutomationSettings {
  autoAssignEditor: boolean;
  autoStartCampaign: boolean;
  sendClientNotifications: boolean;
  addAdminNotifications: boolean;
  autoOfferUpsell: boolean;
}

const DEFAULT_SETTINGS: AutomationSettings = {
  autoAssignEditor: true,
  autoStartCampaign: true,
  sendClientNotifications: true,
  addAdminNotifications: true,
  autoOfferUpsell: true,
};

export async function getAutomationSettings(): Promise<AutomationSettings> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from("automation_settings").select("*").limit(1).single();
    if (!error && data) {
      return {
        autoAssignEditor: data.auto_assign_editor ?? true,
        autoStartCampaign: data.auto_start_campaign ?? true,
        sendClientNotifications: data.send_client_notifications ?? true,
        addAdminNotifications: data.send_internal_alerts ?? true,
        autoOfferUpsell: data.auto_offer_upsell ?? true,
      };
    }
  }
  try {
    const raw = localStorage.getItem("sharpconnect_automation");
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_SETTINGS;
}

export async function updateAutomationSettings(updates: Partial<AutomationSettings>): Promise<AutomationSettings> {
  const current = await getAutomationSettings();
  const next = { ...current, ...updates };

  if (isSupabaseConfigured) {
    const dbUpdates: Record<string, boolean> = {};
    if (updates.autoAssignEditor !== undefined) dbUpdates.auto_assign_editor = updates.autoAssignEditor;
    if (updates.autoStartCampaign !== undefined) dbUpdates.auto_start_campaign = updates.autoStartCampaign;
    if (updates.sendClientNotifications !== undefined) dbUpdates.send_client_notifications = updates.sendClientNotifications;
    if (updates.addAdminNotifications !== undefined) dbUpdates.send_internal_alerts = updates.addAdminNotifications;
    if (updates.autoOfferUpsell !== undefined) dbUpdates.auto_offer_upsell = updates.autoOfferUpsell;

    const existing = await supabase.from("automation_settings").select("id").limit(1).single();
    if (existing.data) {
      await supabase.from("automation_settings").update(dbUpdates).eq("id", existing.data.id);
    } else {
      await supabase.from("automation_settings").insert(dbUpdates);
    }
  }

  localStorage.setItem("sharpconnect_automation", JSON.stringify(next));
  return next;
}

function findLeastLoadedEditor(campaigns: Campaign[]): string {
  const load = editors.map((e) => ({
    editor: e,
    count: campaigns.filter((c) => c.editor === e && ["Editing", "Template Created"].includes(c.status)).length,
  }));
  load.sort((a, b) => a.count - b.count);
  return load[0]?.editor || editors[0];
}

export async function runPaymentApprovedWorkflow(campaignId: string) {
  try {
    const [settings, campaigns] = await Promise.all([getAutomationSettings(), getCampaigns()]);
    const campaign = campaigns.find((c) => c.campaignId === campaignId);
    if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

    await logEvent(campaignId, "payment_approved", { previousStatus: campaign.status });

    await updateCampaign(campaignId, { status: "Paid" });
    addArtistNotification(campaignId, "payment_approved", "Payment Approved ✅", `Your payment of ${campaign.total} GHC has been confirmed. Your campaign is now in production.`);

    if (settings.sendClientNotifications) {
      addPaymentApprovedNotification(campaignId, campaign.artistName, campaign.email, campaign.total);
    }

    if (settings.autoAssignEditor) {
      const editor = findLeastLoadedEditor(campaigns);
      await updateCampaign(campaignId, { editor });
      addEditorAssignedNotification(campaignId, campaign.artistName, editor);
      await logEvent(campaignId, "editor_assigned", { editor });
    }

    if (settings.autoStartCampaign) {
      await updateCampaign(campaignId, { status: "Editing" });
      await logEvent(campaignId, "editing_started", { editor: campaign.editor || findLeastLoadedEditor(campaigns) });

      if (settings.sendClientNotifications) {
        addCampaignStartedNotification(campaignId, campaign.artistName, campaign.email);
      }
    }

    if (settings.addAdminNotifications) {
      addAdminNotification(campaignId, `Payment approved for ${campaign.artistName} — ${campaign.songTitle}`);
    }

    await logEvent(campaignId, "campaign_started", {});
    addArtistNotification(campaignId, "campaign_started", "Campaign Started 🚀", "Your TikTok template is being edited. We'll notify you when it goes live!");
  } catch (err: any) {
    await logError(campaignId, `Payment approval workflow failed: ${err.message}`);
    addWorkflowErrorNotification(campaignId, `Payment approval workflow failed: ${err.message}`);
  }
}

export async function runStatusChangeWorkflow(campaignId: string, newStatus: CampaignStatus) {
  try {
    const settings = await getAutomationSettings();
    const campaigns = await getCampaigns();
    const campaign = campaigns.find((c) => c.campaignId === campaignId);
    if (!campaign) return;

    const eventMap: Record<CampaignStatus, string> = {
      "Pending Verification": "payment_submitted",
      Paid: "payment_approved",
      Assigned: "editor_assigned",
      Editing: "editing_started",
      "Pending Admin Review": "editor_submitted",
      "Needs Revision": "revision_requested",
      Approved: "admin_approved",
      "Pending Artist Review": "artist_review_ready",
      "Artist Revision Requested": "artist_revision_requested",
      "Approved By Artist": "artist_approved",
      "Ready To Schedule": "admin_approved",
      "Template Created": "template_completed",
      Scheduled: "campaign_scheduled",
      Posted: "campaign_posted",
      Completed: "campaign_completed",
      Rejected: "payment_rejected",
    };

    const eventType = eventMap[newStatus];
    if (eventType) {
      await logEvent(campaignId, eventType as any, { previousStatus: campaign.status, newStatus });
    }

    if (newStatus === "Editing") {
      if (settings.sendClientNotifications) {
        addCampaignStartedNotification(campaignId, campaign.artistName, campaign.email);
      }
      if (settings.addAdminNotifications) {
        addAdminNotification(campaignId, `Editing started for ${campaign.artistName} — ${campaign.songTitle}`);
      }
      addArtistNotification(campaignId, "campaign_started", "Editing In Progress 🎬", "Your CapCut template is being edited by our team.");
    }

    if (newStatus === "Pending Admin Review") {
      if (settings.addAdminNotifications) {
        addAdminNotification(campaignId, `Editor submitted work for ${campaign.artistName} — ${campaign.songTitle} — pending admin review`);
      }
      addArtistNotification(campaignId, "editor_submitted", "Edit Submitted for Review 📤", "Your campaign edit has been submitted and is awaiting admin approval.");
    }

    if (newStatus === "Needs Revision") {
      if (settings.addAdminNotifications) {
        addAdminNotification(campaignId, `Revision requested for ${campaign.artistName} — ${campaign.songTitle}`);
      }
      addArtistNotification(campaignId, "revision_requested", "Revision Needed 🔄", "The editor has been asked to revise the submission.");
    }

    if (newStatus === "Pending Artist Review") {
      addArtistNotification(campaignId, "artist_review_ready", "Review Your Edit 👀", `Your edit for "${campaign.songTitle}" is ready! Review it at the link in your tracker.`);
      if (settings.addAdminNotifications) {
        addAdminNotification(campaignId, `Campaign ${campaign.campaignId} sent to artist for review — ${campaign.artistName}`);
      }
    }

    if (newStatus === "Artist Revision Requested") {
      addArtistNotification(campaignId, "artist_revision_requested", "Revision Requested 🔄", "You requested changes. The editor will update and resubmit.");
      if (settings.addAdminNotifications) {
        addAdminNotification(campaignId, `Artist requested revision for ${campaign.campaignId} — ${campaign.artistName}`);
      }
    }

    if (newStatus === "Approved By Artist") {
      addArtistNotification(campaignId, "artist_approved", "You Approved ✅", "You approved the final version. Your campaign will be scheduled soon!");
      if (settings.addAdminNotifications) {
        addAdminNotification(campaignId, `Artist approved final version for ${campaign.campaignId} — ${campaign.artistName}`);
      }
    }

    if (newStatus === "Approved") {
      if (settings.sendClientNotifications) {
        addCampaignStartedNotification(campaignId, campaign.artistName, campaign.email);
      }
      if (settings.addAdminNotifications) {
        addAdminNotification(campaignId, `Campaign approved: ${campaign.artistName} — ${campaign.songTitle}`);
      }
      addArtistNotification(campaignId, "admin_approved", "Edit Approved ✅", "Your campaign has been approved and is moving forward!");
    }

    if (newStatus === "Completed") {
      if (settings.sendClientNotifications) {
        addCampaignCompletedNotification(campaignId, campaign.artistName, campaign.email, campaign.packageName);
      }
      if (settings.addAdminNotifications) {
        addAdminNotification(campaignId, `Campaign completed: ${campaign.artistName} — ${campaign.songTitle}`);
      }
      addArtistNotification(campaignId, "campaign_completed", "Campaign Complete 🎉", "Your campaign is done! Thanks for choosing SharpConnect.");
    }
  } catch (err: any) {
    await logError(campaignId, `Status change workflow failed: ${err.message}`);
  }
}

export async function runPaymentRejectedWorkflow(campaignId: string) {
  try {
    const [campaigns, settings] = await Promise.all([getCampaigns(), getAutomationSettings()]);
    const campaign = campaigns.find((c) => c.campaignId === campaignId);
    if (!campaign) return;

    await logEvent(campaignId, "payment_rejected", { status: "rejected" });

    if (settings.addAdminNotifications) {
      addAdminNotification(campaignId, `Payment rejected for ${campaign.artistName} — ${campaign.songTitle}`);
    }
  } catch { /* workflow failed gracefully */ }
}

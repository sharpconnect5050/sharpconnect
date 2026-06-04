/**
 * Local testing mode — seeds localStorage with realistic test data
 * so the app works offline without Supabase/Telegram/Gemini.
 *
 * Enable by:
 *   1. Set NEXT_PUBLIC_TEST_MODE=true in .env.local, or
 *   2. Call enableTestMode() from browser console
 */

const TEST_KEY = "sharpconnect_test_mode";

export function isTestMode(): boolean {
  if (typeof window === "undefined") return process.env.NEXT_PUBLIC_TEST_MODE === "true";
  return process.env.NEXT_PUBLIC_TEST_MODE === "true" || localStorage.getItem(TEST_KEY) === "true";
}

export function enableTestMode() {
  localStorage.setItem(TEST_KEY, "true");
  seedTestData();
}

export function disableTestMode() {
  localStorage.removeItem(TEST_KEY);
}

export function resetTestData() {
  const keys = [
    "sharpconnect_submissions",
    "sharpconnect_uploads",
    "sharpconnect_events",
    "sharpconnect_notifications",
    "sharpconnect_automation",
    "sharpconnect_notification_logs",
    "sharpconnect_editor_assignments",
    "sharpconnect_editor_tasks",
    "sharpconnect_schedules",
    "sharpconnect_post_submission_tasks",
    "sharpconnect_submissions_history",
    "sharpconnect_review_history",
    "sharpconnect_artist_reviews",
    "sharpconnect_admin_reviews",
    "sharpconnect_review_tokens",
    "sharpconnect_review_comments",
  ];
  keys.forEach((k) => {
    try { localStorage.removeItem(k); } catch {}
  });
  seedTestData();
}

function now(offsetDays = 0, offsetHours = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(d.getHours() + offsetHours);
  return d.toISOString();
}

export function seedTestData() {
  if (typeof window === "undefined") return;

  // Only seed if localStorage is empty
  const existing = (() => {
    try { return JSON.parse(localStorage.getItem("sharpconnect_submissions") || "[]"); } catch { return []; }
  })();
  if (existing.length > 0) return;

  const campaigns = [
    {
      campaignId: "TEST-001", status: "Editing", submittedAt: now(-7), artistName: "Kofi Nartey",
      songTitle: "Midnight Vibe", tiktokHandle: "@kofi_nartey", instagramHandle: "@kofi_nartey",
      whatsapp: "+233501234567", email: "kofi@example.com", packageId: "pkg-basic",
      packageName: "Basic Promo", packagePrice: 150, soundOption: "use_original",
      soundFee: 0, total: 150, creativeDirection: "Dark cinematic vibe with transitions",
      selectedTags: ["afrobeats", "cinematic", "night"], hasAudio: true, hasVideo: false,
      senderName: "Kofi Nartey", senderNumber: "+233501234567", amountSent: "150",
      transactionId: "TXN-TEST-001", paymentMethod: "mtn", editor: "BennyEdits",
      priority: "High", notes: "Client wants this ASAP", audioUrl: "", videoUrl: "",
      tiktokSoundLink: "",
    },
    {
      campaignId: "TEST-002", status: "Pending Verification", submittedAt: now(-1), artistName: "Ama Serwaa",
      songTitle: "Electric Dreams", tiktokHandle: "@ama_serwaa", instagramHandle: "@ama_serwaa",
      whatsapp: "+233507654321", email: "ama@example.com", packageId: "pkg-premium",
      packageName: "Premium Promo", packagePrice: 350, soundOption: "create_original",
      soundFee: 50, total: 400, creativeDirection: "Bright colorful energetic",
      selectedTags: ["amapiano", "dance", "colorful"], hasAudio: true, hasVideo: true,
      senderName: "Ama Serwaa", senderNumber: "+233507654321", amountSent: "400",
      transactionId: "TXN-TEST-002", paymentMethod: "vodafone", editor: "",
      priority: "Medium", notes: "", audioUrl: "", videoUrl: "", tiktokSoundLink: "",
    },
    {
      campaignId: "TEST-003", status: "Completed", submittedAt: now(-14), artistName: "Yaw Poku",
      songTitle: "Summer Flex", tiktokHandle: "@yaw_poku", instagramHandle: "@yaw_poku",
      whatsapp: "+233508881234", email: "yaw@example.com", packageId: "pkg-standard",
      packageName: "Standard Promo", packagePrice: 250, soundOption: "use_original",
      soundFee: 0, total: 250, creativeDirection: "Summer beach party feel",
      selectedTags: ["summer", "party", "beach"], hasAudio: true, hasVideo: false,
      senderName: "Yaw Poku", senderNumber: "+233508881234", amountSent: "250",
      transactionId: "TXN-TEST-003", paymentMethod: "mtn", editor: "SharpEditz Team",
      priority: "Low", notes: "Campaign completed successfully", audioUrl: "",
      videoUrl: "", tiktokSoundLink: "https://vm.tiktok.com/TEST-003/",
    },
    {
      campaignId: "TEST-004", status: "Pending Artist Review", submittedAt: now(-3), artistName: "Efia Osei",
      songTitle: "Moonlight Dance", tiktokHandle: "@efia_osei", instagramHandle: "@efia_osei",
      whatsapp: "+233509992223", email: "efia@example.com", packageId: "pkg-premium",
      packageName: "Premium Promo", packagePrice: 350, soundOption: "create_original",
      soundFee: 50, total: 400, creativeDirection: "Romantic moonlit dance floor",
      selectedTags: ["romantic", "slow", "moonlight"], hasAudio: true, hasVideo: true,
      senderName: "Efia Osei", senderNumber: "+233509992223", amountSent: "400",
      transactionId: "TXN-TEST-004", paymentMethod: "mtn", editor: "Internal Editor 1",
      priority: "Medium", notes: "Waiting for artist approval", audioUrl: "",
      videoUrl: "", tiktokSoundLink: "",
    },
    {
      campaignId: "TEST-005", status: "Rejected", submittedAt: now(-10), artistName: "Kwame Mensah",
      songTitle: "Broken Heart", tiktokHandle: "@kwame_mensah", instagramHandle: "@kwame_mensah",
      whatsapp: "+233504445556", email: "kwame@example.com", packageId: "pkg-basic",
      packageName: "Basic Promo", packagePrice: 150, soundOption: "use_original",
      soundFee: 0, total: 150, creativeDirection: "Emotional sad vibe",
      selectedTags: ["sad", "emotional", "slow"], hasAudio: true, hasVideo: false,
      senderName: "Kwame Mensah", senderNumber: "+233504445556", amountSent: "100",
      transactionId: "TXN-TEST-005", paymentMethod: "mtn", editor: "",
      priority: "Medium", notes: "Payment amount mismatch — sent 100 instead of 150",
      audioUrl: "", videoUrl: "", tiktokSoundLink: "",
    },
  ];

  try {
    localStorage.setItem("sharpconnect_submissions", JSON.stringify(campaigns));
  } catch { /* quota exceeded — skip */ }

  // Seed events
  const events = [
    { campaignId: "TEST-001", eventType: "payment_approved", metadata: { previousStatus: "Pending Verification" }, timestamp: now(-6) },
    { campaignId: "TEST-001", eventType: "editor_assigned", metadata: { editor: "BennyEdits" }, timestamp: now(-5) },
    { campaignId: "TEST-001", eventType: "editing_started", metadata: {}, timestamp: now(-4) },
    { campaignId: "TEST-003", eventType: "payment_approved", metadata: {}, timestamp: now(-13) },
    { campaignId: "TEST-003", eventType: "editor_assigned", metadata: {}, timestamp: now(-12) },
    { campaignId: "TEST-003", eventType: "editing_started", metadata: {}, timestamp: now(-11) },
    { campaignId: "TEST-003", eventType: "editor_submitted", metadata: {}, timestamp: now(-8) },
    { campaignId: "TEST-003", eventType: "admin_approved", metadata: {}, timestamp: now(-7) },
    { campaignId: "TEST-003", eventType: "campaign_posted", metadata: {}, timestamp: now(-5) },
    { campaignId: "TEST-003", eventType: "campaign_completed", metadata: {}, timestamp: now(-4) },
    { campaignId: "TEST-005", eventType: "payment_submitted", metadata: {}, timestamp: now(-10) },
    { campaignId: "TEST-005", eventType: "payment_rejected", metadata: { reason: "Amount mismatch" }, timestamp: now(-9) },
  ];
  try { localStorage.setItem("sharpconnect_events", JSON.stringify(events)); } catch {}

  // Seed notifications
  const notifications = [
    { id: "n1", type: "new_campaign", title: "Campaign Submitted", message: "Kofi Nartey submitted Midnight Vibe", campaignId: "TEST-001", priority: "medium", read: false, createdAt: now(-7) },
    { id: "n2", type: "payment_uploaded", title: "Payment Uploaded", message: "Payment of 150 GHC received for TEST-001", campaignId: "TEST-001", priority: "high", read: false, createdAt: now(-6) },
    { id: "n3", type: "editor_submitted", title: "Editor Submitted", message: "BennyEdits completed work on TEST-004", campaignId: "TEST-004", priority: "high", read: false, createdAt: now(-2) },
    { id: "n4", type: "campaign_completed", title: "Campaign Completed", message: "TEST-003 (Summer Flex) completed successfully", campaignId: "TEST-003", priority: "low", read: true, createdAt: now(-4) },
    { id: "n5", type: "payment_uploaded", title: "Payment Mismatch", message: "TEST-005: expected 150, received 100", campaignId: "TEST-005", priority: "urgent", read: false, createdAt: now(-10) },
  ];
  try { localStorage.setItem("sharpconnect_notifications", JSON.stringify(notifications)); } catch {}

  // Seed schedules
  const schedules = [
    {
      id: "s1", campaignId: "TEST-003", platformName: "BennyEdits", platformTikTokHandle: "@bennyedits",
      scheduledDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
      scheduledTime: "14:00", postingStatus: "Scheduled", postingDate: "", postingTime: "",
      tiktokUrl: "https://vm.tiktok.com/TEST-003/", assignedPoster: "benny",
      submittedBy: "benny", submittedAt: now(-4), verifiedBy: "admin",
      verifiedAt: now(-3), notes: "Scheduled for tomorrow",
    },
  ];
  try { localStorage.setItem("sharpconnect_schedules", JSON.stringify(schedules)); } catch {}

  // Seed review tokens for test campaigns
  try {
    const tokens = [
      {
        token: "test-review-token-efia-004-abc123",
        campaignId: "TEST-004",
        status: "active",
        createdAt: now(-3),
        lastAccessedAt: now(-3),
      },
    ];
    localStorage.setItem("sharpconnect_review_tokens", JSON.stringify(tokens));
  } catch {}

  // Seed review comments for TEST-004
  try {
    const comments = [
      {
        id: "trc-1",
        token: "test-review-token-efia-004-abc123",
        campaignId: "TEST-004",
        text: "The intro looks great! Can we make the transition a bit smoother at 0:14?",
        timestampSeconds: 14,
        version: 1,
        author: "artist",
        createdAt: now(-2, 4),
      },
    ];
    localStorage.setItem("sharpconnect_review_comments", JSON.stringify(comments));
  } catch {}

  // Seed automation settings
  try {
    localStorage.setItem("sharpconnect_automation", JSON.stringify({
      autoAssignEditor: true, autoStartCampaign: true, sendClientNotifications: true,
      addAdminNotifications: true, autoOfferUpsell: false,
    }));
  } catch {}
}

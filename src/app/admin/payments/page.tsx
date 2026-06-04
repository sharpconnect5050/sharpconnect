"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCampaigns, formatDate, formatCurrency, type Campaign } from "@/lib/adminData";
import PaymentReviewModal from "@/components/PaymentReviewModal";

export default function PaymentsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [reviewCampaign, setReviewCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getCampaigns().then((d) => { if (mounted) setCampaigns(d); }).catch(console.error).finally(() => { if (mounted) setLoading(false); });
    const interval = setInterval(() => getCampaigns().then((d) => { if (mounted) setCampaigns(d); }).catch(console.error), 3000);
    return () => { clearInterval(interval); mounted = false; };
  }, []);

  const pending = campaigns.filter((c) => c.status === "Pending Verification");
  const approved = campaigns.filter((c) => c.status === "Paid" || c.status === "Editing" || c.status === "Template Created" || c.status === "Scheduled" || c.status === "Posted" || c.status === "Completed");
  const rejected = campaigns.filter((c) => c.status === "Rejected");

  const tabs = [
    { id: "pending" as const, label: "Pending", count: pending.length, color: "text-yellow-400" },
    { id: "approved" as const, label: "Approved", count: approved.length, color: "text-green-400" },
    { id: "rejected" as const, label: "Rejected", count: rejected.length, color: "text-red-400" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Payments</h1>
        <p className="text-xs sm:text-sm text-zinc-500 mt-1">{pending.length} pending review</p>
      </div>

      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-all ${
              activeTab === tab.id
                ? "bg-white/10 border-white/20 text-white"
                : "border-white/5 text-zinc-500"
            }`}
          >
            <span className={tab.color}>{tab.count}</span>
            <span className="ml-1.5">{tab.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "pending" && (
          <motion.div
            key="pending"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {pending.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 text-center">
                <p className="text-sm text-zinc-600">All caught up! No pending payments.</p>
              </div>
            ) : (
              pending.map((c) => (
                <motion.div
                  key={c.campaignId}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setReviewCampaign(c)}
                  className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 backdrop-blur-xl p-4 cursor-pointer active:scale-[0.98] transition-transform hover:border-yellow-500/40"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-[10px] font-mono text-red-400">{c.campaignId}</code>
                        <span className="text-xs font-semibold text-white">{c.artistName}</span>
                        <span className="text-[10px] text-zinc-500">- {c.songTitle}</span>
                      </div>
                      <p className="text-[10px] text-zinc-600 mt-1">{formatDate(c.submittedAt)}</p>
                    </div>
                    <span className="text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600 shrink-0">{formatCurrency(c.total)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4 p-3 rounded-lg bg-black/40 text-xs">
                    {[
                      { label: "Sender", value: c.senderName },
                      { label: "Amount", value: c.amountSent },
                      { label: "Transaction", value: c.transactionId },
                      { label: "Method", value: c.paymentMethod || "—" },
                    ].map((f) => (
                      <div key={f.label}>
                        <p className="text-[10px] text-zinc-600">{f.label}</p>
                        <p className="text-white font-medium text-xs truncate">{f.value || "—"}</p>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); setReviewCampaign(c); }}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white text-xs font-semibold active:scale-[0.98] transition-transform touch-target"
                  >
                    Review Payment
                  </button>
                </motion.div>
              ))
            )}
          </motion.div>
        )}

        {activeTab === "approved" && (
          <motion.div
            key="approved"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {approved.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 text-center">
                <p className="text-sm text-zinc-600">No approved payments yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {approved.map((c) => (
                  <div key={c.campaignId} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 backdrop-blur-xl p-4 text-sm">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                      <code className="text-[10px] font-mono text-red-400 shrink-0">{c.campaignId}</code>
                      <span className="text-zinc-300 text-xs truncate">{c.artistName}</span>
                    </div>
                    <span className="text-xs text-zinc-500 shrink-0 ml-2">{formatCurrency(c.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "rejected" && (
          <motion.div
            key="rejected"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {rejected.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 text-center">
                <p className="text-sm text-zinc-600">No rejected payments</p>
              </div>
            ) : (
              <div className="space-y-2">
                {rejected.map((c) => (
                  <div key={c.campaignId} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 backdrop-blur-xl p-4 text-sm">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                      <code className="text-[10px] font-mono text-red-400 shrink-0">{c.campaignId}</code>
                      <span className="text-zinc-300 text-xs truncate">{c.artistName}</span>
                    </div>
                    <span className="text-xs text-zinc-500 shrink-0 ml-2">{formatCurrency(c.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reviewCampaign && (
          <PaymentReviewModal
            campaign={reviewCampaign}
            onClose={() => setReviewCampaign(null)}
            onApproved={() => { setReviewCampaign(null); getCampaigns().then(setCampaigns).catch(console.error); }}
            onRejected={() => { setReviewCampaign(null); getCampaigns().then(setCampaigns).catch(console.error); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

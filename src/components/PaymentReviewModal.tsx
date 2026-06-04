"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { getCampaignUploads, type UploadRecord } from "@/lib/storage";
import { formatCurrency, formatDate, type Campaign } from "@/lib/adminData";
import { getEventLogs } from "@/lib/events";
import { addArtistNotification } from "@/lib/artistNotifications";
import { addAlert } from "./AdminNotifications";
import PaymentProofViewer from "./PaymentProofViewer";

interface PaymentReviewModalProps {
  campaign: Campaign;
  onClose: () => void;
  onApproved: (id: string) => void;
  onRejected: (id: string) => void;
}

type ReviewAction = "approve" | "reject" | "request-new-proof" | null;
type ReviewState = "idle" | "confirming" | "processing" | "done";

function formatPhoneForWhatsApp(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.slice(1);
  } else if (cleaned.startsWith("0")) {
    cleaned = "233" + cleaned.slice(1);
  }
  return cleaned;
}

function generateWhatsAppMessage(campaign: Campaign): string {
  return [
    `Hi ${campaign.artistName}, your payment for your SharpConnect campaign has been confirmed successfully.`,
    "",
    "Your campaign is now moving into production and our team will begin preparing your edit shortly.",
    "",
    `Package: ${campaign.packageName}`,
    `Tracking Code: ${campaign.campaignId}`,
    "",
    "You\u2019ll receive updates as your campaign progresses.",
    "",
    "\u2014 SharpConnect",
  ].join("\n");
}

export default function PaymentReviewModal({ campaign, onClose, onApproved, onRejected }: PaymentReviewModalProps) {
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [proofViewerOpen, setProofViewerOpen] = useState(false);
  const [proofSrc, setProofSrc] = useState("");
  const [action, setAction] = useState<ReviewAction>(null);
  const [state, setState] = useState<ReviewState>("idle");
  const [rejectReason, setRejectReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [whatsappSent, setWhatsappSent] = useState(false);

  const waMessage = useMemo(() => generateWhatsAppMessage(campaign), [campaign]);
  const waPhone = useMemo(() => formatPhoneForWhatsApp(campaign.whatsapp), [campaign.whatsapp]);
  const hasValidPhone = useMemo(() => waPhone.length >= 10, [waPhone]);
  const waUrl = useMemo(
    () => (hasValidPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(waMessage)}` : null),
    [hasValidPhone, waPhone, waMessage]
  );

  useEffect(() => {
    let mounted = true;
    getCampaignUploads(campaign.campaignId).then((d) => { if (mounted) setUploads(d); }).catch(console.error);
    getEventLogs().then((logs) => {
      if (!mounted) return;
      const relevant = logs
        .filter((l: any) => l.campaignId === campaign.campaignId && ["payment_approved", "payment_rejected", "proof_requested"].includes(l.eventType))
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setHistory(relevant);
    }).catch(console.error);
    return () => { mounted = false; };
  }, [campaign.campaignId]);

  const proofUploads = useMemo(() => uploads.filter((u) => u.file_type === "payment_proof" || u.file_type === "payment_receipt"), [uploads]);
  const proofImage = useMemo(() => proofUploads.find((u) => u.file_type === "payment_proof") || proofUploads[0], [proofUploads]);
  const receiptImage = useMemo(() => proofUploads.find((u) => u.file_type === "payment_receipt"), [proofUploads]);

  const expectedAmount = campaign.total;
  const submittedAmount = useMemo(() => parseFloat(campaign.amountSent?.replace(/[^0-9.]/g, "") || "0"), [campaign.amountSent]);
  const amountMismatch = useMemo(() => submittedAmount > 0 && Math.abs(submittedAmount - expectedAmount) > 0.01, [submittedAmount, expectedAmount]);

  const handleAction = async (a: ReviewAction) => {
    if (!a) return;
    setAction(a);
    if (a === "reject" && !rejectReason) {
      setState("confirming");
      return;
    }
    setState("processing");
    try {
      const adminToken = typeof window !== "undefined" ? sessionStorage.getItem("sharpconnect_admin") : null;
      const res = await fetch(`/api/payment-review/${campaign.campaignId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(adminToken ? { Authorization: adminToken } : {}) },
        body: JSON.stringify({ action: a, reason: rejectReason, notes: adminNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setState("done");
      if (a === "approve") {
        addAlert("campaign_started", `Payment approved for ${campaign.campaignId} — campaign now in production`, campaign.campaignId);
        onApproved(campaign.campaignId);
      }
      if (a === "reject") {
        addAlert("payment_uploaded", `Payment rejected for ${campaign.campaignId}${rejectReason ? `: ${rejectReason}` : ""}`, campaign.campaignId);
        onRejected(campaign.campaignId);
      }
      if (a === "request-new-proof") {
        addAlert("payment_uploaded", `New payment proof requested for ${campaign.campaignId}${adminNotes ? `: ${adminNotes}` : ""}`, campaign.campaignId);
        addArtistNotification(campaign.campaignId, "revision_requested", "New Payment Proof Required 📸", `Admin requested a new payment proof for ${campaign.campaignId}.${adminNotes ? ` Reason: ${adminNotes}` : ""}. Please contact SharpConnect support to re-upload.`);
        const waMsg = `Hi ${campaign.artistName}, this is SharpConnect regarding your campaign ${campaign.campaignId}. We noticed an issue with your payment proof.${adminNotes ? ` ${adminNotes}` : ""} Could you please send a clear screenshot of the payment transaction? Thank you.`;
        const waPhone = process.env.NEXT_PUBLIC_WHATSAPP_PHONE || "233556513157";
        const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(waMsg)}`;
        window.open(waUrl, "_blank");
        setTimeout(onClose, 1500);
      }
    } catch (e) { console.error("[handleAction] failed:", e); setState("idle"); }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={state === "processing" || state === "done" ? undefined : onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed inset-4 md:inset-6 lg:inset-10 z-50 flex flex-col rounded-2xl border border-white/[0.08] bg-[#0a0a0a] backdrop-blur-xl overflow-hidden overscroll-contain"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-white/[0.08] shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-white truncate">Payment Review</h2>
              <code className="text-[10px] font-mono text-red-400 bg-red-500/10 px-2 py-0.5 rounded">{campaign.campaignId}</code>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">{campaign.artistName} — {campaign.songTitle}</p>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white transition-colors touch-target">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {state === "done" ? (
            <>
              <div className="flex flex-col items-center justify-center py-8">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
                  action === "approve" ? "bg-green-500/20" : action === "reject" ? "bg-red-500/20" : "bg-amber-500/20"
                }`}>
                  {action === "approve" ? (
                    <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  ) : action === "reject" ? (
                    <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  ) : (
                    <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  )}
                </div>
                <p className="text-lg font-semibold text-white">
                  {action === "approve" ? "Payment Approved" : action === "reject" ? "Payment Rejected" : "Request Sent"}
                </p>
                <p className="text-sm text-zinc-500 mt-1">
                  {action === "approve" ? "Campaign is now in production." : action === "reject" ? "Campaign has been rejected." : "Client will be notified."}
                </p>
              </div>

              {/* WhatsApp Confirmation (only for approve) */}
              {action === "approve" && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    <h4 className="text-sm font-semibold text-white">WhatsApp Confirmation</h4>
                  </div>

                  {hasValidPhone ? (
                    <>
                      <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-4 mb-4">
                        <p className="text-[11px] text-zinc-400 whitespace-pre-line leading-relaxed">{waMessage}</p>
                      </div>

                      <div className="flex items-center gap-2 p-3 rounded-lg bg-white/[0.03] mb-4">
                        <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        <span className="text-xs text-zinc-400">Sending to: <span className="text-white font-medium">{campaign.whatsapp}</span></span>
                      </div>

                      <div className="flex gap-2">
                        <a
                          href={waUrl!}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setWhatsappSent(true)}
                          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all active:scale-[0.98] touch-target"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          {whatsappSent ? "Send Again" : "Send WhatsApp Confirmation"}
                        </a>
                      </div>

                      {whatsappSent && (
                        <p className="text-[10px] text-emerald-400/70 text-center mt-2">WhatsApp conversation opened in new tab</p>
                      )}
                    </>
                  ) : (
                    <div className="rounded-xl bg-amber-500/[0.06] border border-amber-500/20 p-4 flex items-start gap-3">
                      <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                      <div>
                        <p className="text-xs font-semibold text-amber-400">No Phone Number Available</p>
                        <p className="text-[11px] text-amber-300/80 mt-0.5">The artist did not provide a WhatsApp number during submission. Notify them manually.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Payment Proof Image */}
              {proofImage && (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.05]">
                    <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Payment Proof</h4>
                    <button onClick={() => { setProofSrc(proofImage.file_url); setProofViewerOpen(true); }}
                      className="text-[10px] text-blue-400 hover:text-blue-300 touch-target"
                    >Expand</button>
                  </div>
                  <div className="relative group cursor-pointer" onClick={() => { setProofSrc(proofImage.file_url); setProofViewerOpen(true); }}>
                    <img
                      src={proofImage.file_url}
                      alt="Payment proof"
                      className="w-full max-h-64 object-contain bg-black/40"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                      <span className="text-sm text-white font-medium flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                        Zoom
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {receiptImage && (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.05]">
                    <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Payment Receipt</h4>
                    <button onClick={() => { setProofSrc(receiptImage.file_url); setProofViewerOpen(true); }}
                      className="text-[10px] text-blue-400 hover:text-blue-300 touch-target"
                    >Expand</button>
                  </div>
                  <div className="relative group cursor-pointer" onClick={() => { setProofSrc(receiptImage.file_url); setProofViewerOpen(true); }}>
                    <img
                      src={receiptImage.file_url}
                      alt="Payment receipt"
                      className="w-full max-h-48 object-contain bg-black/40"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                      <span className="text-sm text-white font-medium flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                        Zoom
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {!proofImage && !receiptImage && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-center">
                  <p className="text-sm text-amber-400 font-medium">No payment proof uploaded</p>
                  <p className="text-xs text-zinc-500 mt-1">The client may not have submitted a proof image.</p>
                </div>
              )}

              {/* Amount Comparison */}
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4">
                <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Amount Comparison</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-white/[0.04]">
                    <p className="text-[10px] text-zinc-600">Expected (Package)</p>
                    <p className="text-sm font-bold text-white">{formatCurrency(expectedAmount)}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{campaign.packageName}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/[0.04]">
                    <p className="text-[10px] text-zinc-600">Submitted</p>
                    <p className="text-sm font-bold text-white">{campaign.amountSent || "—"}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{campaign.paymentMethod || ""}</p>
                  </div>
                </div>
                {amountMismatch && (
                  <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5">
                    <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                    <div>
                      <p className="text-xs font-semibold text-amber-400">Amount Mismatch</p>
                      <p className="text-[11px] text-amber-300/80 mt-0.5">Submitted amount differs from expected package total.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Sender Details */}
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4">
                <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Sender Details</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {[
                    { label: "Sender Name", value: campaign.senderName },
                    { label: "Phone Number", value: campaign.senderNumber },
                    { label: "Payment Method", value: campaign.paymentMethod || "—" },
                    { label: "Transaction ID", value: campaign.transactionId },
                  ].map((f) => (
                    <div key={f.label}>
                      <p className="text-[10px] text-zinc-600">{f.label}</p>
                      <p className="text-xs text-white font-medium truncate">{f.value || "—"}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-600 mt-3">Submitted: {formatDate(campaign.submittedAt)}</p>
              </div>

              {/* Payment History */}
              {history.length > 0 && (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4">
                  <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Payment History</h4>
                  <div className="space-y-2">
                    {history.map((h: any, i: number) => (
                      <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white/[0.03]">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                          h.eventType === "payment_approved" ? "bg-green-500" :
                          h.eventType === "payment_rejected" ? "bg-red-500" : "bg-amber-500"
                        }`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-white font-medium capitalize">{h.eventType.replace(/_/g, " ")}</p>
                          {h.metadata?.reason && <p className="text-[10px] text-zinc-500">Reason: {h.metadata.reason}</p>}
                          <p className="text-[9px] text-zinc-600">{new Date(h.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin Notes */}
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4">
                <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Admin Notes</h4>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Optional: Add internal notes about this payment..."
                  rows={3}
                  className="w-full bg-transparent border border-white/[0.08] rounded-xl p-3 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-red-500/50 resize-none"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        {state !== "done" && (
          <div className="px-4 md:px-6 py-4 border-t border-white/[0.08] shrink-0 space-y-3">
            {state === "confirming" ? (
              <div className="space-y-3">
                <p className="text-xs text-zinc-400">Why are you rejecting this payment?</p>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter rejection reason..."
                  rows={2}
                  className="w-full bg-transparent border border-white/[0.08] rounded-xl p-3 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-red-500/50 resize-none"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={() => { setAction(null); setState("idle"); setRejectReason(""); }}
                    className="flex-1 py-3 rounded-xl border border-white/10 text-zinc-400 text-xs font-semibold"
                  >Cancel</button>
                  <button onClick={() => handleAction("reject")} disabled={!rejectReason.trim()}
                    className="flex-1 py-3 rounded-xl bg-red-600 text-white text-xs font-semibold disabled:opacity-50"
                  >Confirm Reject</button>
                </div>
              </div>
            ) : state === "processing" ? (
              <div className="flex items-center justify-center py-3">
                <div className="w-5 h-5 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                <span className="ml-2 text-xs text-zinc-400">Processing...</span>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => handleAction("reject")}
                  className="py-3 rounded-xl border border-red-500/30 text-red-400 text-xs font-semibold active:scale-[0.98] transition-transform touch-target"
                >
                  <svg className="w-3.5 h-3.5 mx-auto mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  Reject
                </button>
                <button onClick={() => handleAction("request-new-proof")}
                  className="py-3 rounded-xl border border-amber-500/30 text-amber-400 text-xs font-semibold active:scale-[0.98] transition-transform touch-target"
                >
                  <svg className="w-3.5 h-3.5 mx-auto mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  Request New Proof
                </button>
                <button onClick={() => handleAction("approve")}
                  className="py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white text-xs font-semibold active:scale-[0.98] transition-transform touch-target"
                >
                  <svg className="w-3.5 h-3.5 mx-auto mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Approve
                </button>
              </div>
            )}
          </div>
        )}
      </motion.div>

      <PaymentProofViewer
        src={proofSrc}
        alt="Payment proof"
        isOpen={proofViewerOpen}
        onClose={() => setProofViewerOpen(false)}
      />
    </>
  );
}

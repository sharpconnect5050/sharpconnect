"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { addAlert } from "@/components/AdminNotifications";

interface CampaignData {
  artistName: string;
  songTitle: string;
  tiktokHandle: string;
  instagramHandle: string;
  whatsapp: string;
  email: string;
  packageId: string;
  packageName: string;
  packagePrice: number;
  soundOption: string;
  soundFee: number;
  total: number;
  creativeDirection: string;
  selectedTags: string[];
  hasAudio: boolean;
  hasVideo: boolean;
  campaignId?: string;
  audioUrl?: string;
  videoUrl?: string;
}

const paymentApps = [
  {
    name: "Chipper Cash",
    desc: "Fast Ghana MoMo transfers from Nigeria.",
    url: "https://chippercash.com",
    gradient: "from-green-600 to-emerald-700",
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  {
    name: "Eversend",
    desc: "Multi-currency app supporting Ghana MoMo.",
    url: "https://eversend.co",
    gradient: "from-blue-600 to-indigo-700",
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>,
  },
  {
    name: "Grey",
    desc: "Send money to Ghana MoMo from Nigeria.",
    url: "https://grey.co",
    gradient: "from-zinc-600 to-zinc-800",
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
  },
  {
    name: "Afriex",
    desc: "Instant transfers to Africa mobile money.",
    url: "https://afriex.co",
    gradient: "from-orange-600 to-red-700",
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
  },
];

import { saveCampaign } from "@/lib/adminData";
import { uploadPaymentProofs } from "@/lib/storage";
import { logCampaignCreated, logPaymentUploaded } from "@/lib/activity-log";

function generateId() {
  return "SC-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

async function saveSubmission(submission: any, status: string, paymentRef: string) {
  await saveCampaign({ ...submission, status, paymentReference: paymentRef });
  sessionStorage.setItem("sharpconnect_submitted", JSON.stringify({ ...submission, status }));
  sessionStorage.removeItem("sharpconnect_campaign");
}

type PaymentMode = "momo" | "manual";

export default function PaymentPage() {
  const [data, setData] = useState<CampaignData | null>(null);
  const [mode, setMode] = useState<PaymentMode | null>(null);

  const [copied, setCopied] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [senderName, setSenderName] = useState("");
  const [senderNumber, setSenderNumber] = useState("");
  const [amountSent, setAmountSent] = useState("");
  const [transactionId, setTransactionId] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [campaignId, setCampaignId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"Paid" | "Pending Verification">("Pending Verification");
  const [paymentRef, setPaymentRef] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const proofRef = useRef<HTMLInputElement>(null);
  const receiptRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("sharpconnect_campaign");
    if (!raw) {
      window.location.href = "/campaign";
      return;
    }
    try { setData(JSON.parse(raw)); } catch (e) { console.error("[PaymentPage] parse failed:", e); window.location.href = "/campaign"; }
  }, []);

  const momoNumber = process.env.NEXT_PUBLIC_MOMO_NUMBER || "0552783151";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(momoNumber.replace(/\s/g, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = momoNumber.replace(/\s/g, "");
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleFileDrop = (e: React.DragEvent, setter: (f: File) => void) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) setter(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>, setter: (f: File) => void) => {
    const file = e.target.files?.[0];
    if (file) setter(file);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!proofFile) errs.proof = "Upload proof of payment";
    if (!senderName.trim()) errs.senderName = "Required";
    else if (senderName.length > 100) errs.senderName = "Max 100 characters";
    if (!senderNumber.trim()) errs.senderNumber = "Required";
    else if (!/^\+?[0-9]{7,15}$/.test(senderNumber.trim().replace(/[\s\-]/g, "")))
      errs.senderNumber = "Enter a valid phone number";
    if (!amountSent.trim()) errs.amountSent = "Required";
    else if (!/^\d+(\.\d{1,2})?$/.test(amountSent.trim()) || parseFloat(amountSent) <= 0)
      errs.amountSent = "Enter a valid amount";
    if (!transactionId.trim()) errs.transactionId = "Required";
    else if (transactionId.length > 100) errs.transactionId = "Max 100 characters";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    try {
      const id = data?.campaignId || generateId();
      const ref = "TXN-" + Date.now().toString(36).toUpperCase();

      let proofUrl = "";
      if (proofFile || receiptFile) {
        const result = await uploadPaymentProofs(id, { proof: proofFile, receipt: receiptFile });
        proofUrl = result.proofUrl || "";
        if (result.errors.length > 0) console.warn("Upload errors:", result.errors);
      }

      const submission = {
        campaignId: id,
        status: "Pending Verification",
        submittedAt: new Date().toISOString(),
        ...data,
        senderName,
        senderNumber,
        amountSent,
        transactionId,
        hasProof: !!proofFile,
        hasReceipt: !!receiptFile,
        paymentMethod: "Mobile Money",
        proofUrl,
        audioUrl: data?.audioUrl || "",
        videoUrl: data?.videoUrl || "",
      };

      await saveSubmission(submission, "Pending Verification", ref);

      logCampaignCreated(id, data?.artistName || "Unknown");
      logPaymentUploaded(id, data?.artistName || "Unknown", amountSent);

      if (data) {
        addAlert("new_campaign", `New campaign submitted by ${data.artistName} — ${data.songTitle}`, id);
      }
      if (proofFile || receiptFile) {
        addAlert("payment_uploaded", `Payment proof uploaded for ${id} by ${senderName}`, id);
      }

      setCampaignId(id);
      setPaymentRef(ref);

      setTimeout(() => {
        setSubmitting(false);
        setSubmitted(true);
      }, 1500);
    } catch (e) {
      console.error("[PaymentPage] submit failed:", e);
      setSubmitting(false);
    }
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (submitted) {
    const isPaid = paymentStatus === "Paid";
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-sm w-full text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
            className={`w-20 h-20 mx-auto rounded-2xl flex items-center justify-center mb-6 shadow-lg ${
              isPaid
                ? "bg-gradient-to-br from-green-500 to-emerald-600 shadow-green-500/20"
                : "bg-gradient-to-br from-yellow-500 to-orange-600 shadow-yellow-500/20"
            }`}
          >
            {isPaid ? (
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </motion.div>

          <h1 className="text-2xl font-bold mb-2">{isPaid ? "Payment Successful" : "Payment Submitted"}</h1>
          <p className="text-sm text-zinc-500 mb-8">
            {isPaid ? "Your campaign is now live and in production." : "Our team will verify your payment and begin shortly."}
          </p>

          <div className="text-left space-y-3 mb-6">
            <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
              <span className="text-[10px] text-zinc-600">Campaign ID</span>
              <code className="text-xs font-mono text-red-400 bg-red-500/10 px-2 py-0.5 rounded">{campaignId}</code>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
              <span className="text-[10px] text-zinc-600">Package</span>
              <span className="text-xs text-white font-medium">{data.packageName}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
              <span className="text-[10px] text-zinc-600">Amount</span>
              <span className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600">GHC {data.total.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-[10px] text-zinc-600">Status</span>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full animate-pulse ${isPaid ? "bg-green-500" : "bg-yellow-500"}`} />
                <span className={`text-xs font-medium ${isPaid ? "text-green-400" : "text-yellow-400"}`}>{isPaid ? "Paid" : "Pending Verification"}</span>
              </div>
            </div>
            {paymentRef && (
              <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
                <span className="text-[10px] text-zinc-600">Reference</span>
                <span className="text-[10px] font-mono text-zinc-400">{paymentRef}</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <a href="/track" className="block w-full py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-medium text-sm text-center transition-all shadow-lg shadow-red-500/10">
              Track Campaign
            </a>
            <a href="/" className="block w-full py-3 text-xs text-zinc-500 hover:text-white transition-colors">Back to Home</a>
          </div>
        </motion.div>
      </div>
    );
  }

  const soundLabel = data.soundOption === "slow-reverb" ? "Slow + Reverb" : data.soundOption === "fast" ? "Fast Version" : "Original Sound";

  if (!mode) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <div className="max-w-sm w-full">
          <div className="text-center mb-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-lg font-bold mb-4">
                S
              </div>
              <h1 className="text-2xl font-bold">Choose Payment Method</h1>
              <p className="text-sm text-zinc-500 mt-1">GHC {data.total.toLocaleString()} due</p>
            </motion.div>
          </div>

          <div className="space-y-3">
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setMode("momo")}
              className="w-full text-left p-5 rounded-2xl bg-gradient-to-br from-yellow-500/[0.06] to-yellow-600/[0.03] border border-yellow-500/25 hover:border-yellow-500/40 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-yellow-500/15 flex items-center justify-center shrink-0">
                  <svg className="w-7 h-7 text-yellow-400" fill="currentColor" viewBox="0 0 24 24"><path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"/></svg>
                </div>
                <div className="flex-1">
                  <p className="text-base font-bold text-white">Pay with MTN MoMo</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Instant payment — enter PIN on your phone</p>
                </div>
                <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </div>
            </motion.button>

            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setMode("manual")}
              className="w-full text-left p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-white/[0.04] flex items-center justify-center shrink-0">
                  <svg className="w-7 h-7 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
                <div className="flex-1">
                  <p className="text-base font-bold text-white">Manual Payment</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Send via cross-border app & upload proof</p>
                </div>
                <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </div>
            </motion.button>
          </div>

          <div className="mt-8 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">{data.packageName}</span>
              <span className="text-white font-medium">GHC {data.packagePrice.toLocaleString()}</span>
            </div>
            {data.soundFee > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Sound Edit</span>
                <span className="text-white font-medium">GHC {data.soundFee}</span>
              </div>
            )}
            <div className="border-t border-white/[0.04] pt-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Total</span>
              <span className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600">GHC {data.total.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "momo") {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center mb-4 shadow-lg shadow-yellow-500/20">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"/></svg>
            </div>
            <h2 className="text-xl font-bold mb-2">Auto MoMo — Coming Soon</h2>
            <p className="text-sm text-zinc-500 mb-6">
              Automatic MoMo payments are not yet available. Please use manual payment instead.
            </p>
            <button onClick={() => setMode("manual")}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold text-sm transition-all shadow-lg shadow-red-500/10"
            >
              Use Manual Payment Instead
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-white/[0.04] bg-black/80 backdrop-blur-xl">
        <div className="max-w-lg mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center font-bold text-xs">S</div>
            <span className="font-semibold text-sm">SharpConnect</span>
          </div>
          <button onClick={() => setMode(null)} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Back</button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 pb-28">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold">Manual Payment</h1>
          <p className="text-sm text-zinc-500 mt-1">Send via cross-border app and upload proof</p>
        </motion.div>

        <div className="flex items-center gap-3 text-xs mt-5 py-3 border-b border-white/[0.04]">
          <span className="text-zinc-500">{data.artistName}</span>
          <span className="text-zinc-700">/</span>
          <span className="text-zinc-500">{data.packageName}</span>
          <span className="text-zinc-700">/</span>
          <span className="text-zinc-500">{soundLabel}</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="py-5 border-b border-white/[0.04]"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-yellow-500/15 text-yellow-400 text-[10px] font-semibold">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"/></svg>
              MTN MoMo
            </div>
            <span className="px-2 py-0.5 rounded bg-white/[0.04] text-zinc-500 text-[10px]">🇬🇭 Ghana</span>
          </div>

          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[10px] text-zinc-600 mb-0.5">Send to</p>
              <p className="text-xl font-bold text-white tracking-wider">{process.env.NEXT_PUBLIC_MOMO_NUMBER || "0552 783 151"}</p>
            </div>
            <button
              onClick={handleCopy}
              className={`flex items-center gap-2 px-4 py-3.5 rounded-xl text-xs font-semibold transition-all touch-target ${
                copied
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-yellow-500/15 text-yellow-400 active:scale-95 hover:bg-yellow-500/20"
              }`}
            >
              {copied ? (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copied!</>
              ) : (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy</>
              )}
            </button>
          </div>

          <div className="flex items-center gap-4 text-sm mt-3">
            <div>
              <p className="text-[10px] text-zinc-600">Account</p>
              <p className="text-white font-semibold">Boateng Elliot</p>
            </div>
            <span className="w-px h-6 bg-white/[0.04]" />
            <div>
              <p className="text-[10px] text-zinc-600">Amount</p>
              <p className="text-white font-bold">GHC {data.total.toLocaleString()}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="py-5 border-b border-white/[0.04]"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🇳🇬</span>
            <h2 className="text-sm font-bold text-white">How Nigerian Clients Can Pay</h2>
          </div>
          <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
            Send Naira equivalent to our Ghana MTN MoMo number using trusted cross-border apps.
          </p>
          <div className="space-y-2">
            {paymentApps.map((app, i) => (
              <motion.a
                key={app.name}
                href={app.url}
                target="_blank" rel="noopener noreferrer"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.04 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.06] active:scale-[0.98] transition-all touch-target"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${app.gradient} flex items-center justify-center shrink-0`}>{app.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{app.name}</p>
                  <p className="text-[11px] text-zinc-500 truncate">{app.desc}</p>
                </div>
                <span className="text-[10px] text-zinc-600 shrink-0">Open →</span>
              </motion.a>
            ))}
          </div>
        </motion.div>

        <motion.form
          onSubmit={handleManualSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
        >
          <div className="py-5 border-b border-white/[0.04]">
            <h2 className="text-sm font-bold mb-4">Proof of Payment</h2>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleFileDrop(e, setProofFile)}
              onClick={() => proofRef.current?.click()}
              className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-all duration-300 ${
                proofFile ? "border-emerald-500/25 bg-emerald-500/[0.04]" : "border-white/[0.06] hover:border-red-500/25"
              }`}
            >
              <input ref={proofRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => handleFileInput(e, setProofFile)} />
              {proofFile ? (
                <div className="space-y-2">
                  <div className="w-10 h-10 mx-auto rounded-xl bg-emerald-500/15 flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <p className="text-xs text-zinc-300 truncate">{proofFile.name}</p>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setProofFile(null); }} className="text-[10px] text-red-400 hover:text-red-300">Remove</button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-red-500/10 flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  </div>
                  <p className="text-sm text-zinc-300 font-medium">Upload Screenshot</p>
                  <p className="text-[10px] text-zinc-600">Tap to upload payment confirmation</p>
                </div>
              )}
            </div>
            {errors.proof && <p className="text-xs text-red-400 mt-2">{errors.proof}</p>}
          </div>

          <div className="py-5 border-b border-white/[0.04]">
            <h3 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-4">Sender Details</h3>
            <div className="grid grid-cols-1 gap-3">
              {[
                { label: "Full Name", value: senderName, setter: setSenderName, key: "senderName" },
                { label: "Phone Number", value: senderNumber, setter: setSenderNumber, key: "senderNumber" },
                { label: "Amount Sent", value: amountSent, setter: setAmountSent, key: "amountSent", placeholder: "e.g. GHC 1000" },
                { label: "Transaction ID", value: transactionId, setter: setTransactionId, key: "transactionId" },
              ].map((f) => (
                <div key={f.key} className="relative">
                  <input id={f.key} type="text" value={f.value} onChange={(e) => f.setter(e.target.value)} placeholder={f.placeholder || ""}
                    className={`peer w-full bg-transparent border rounded-xl px-4 pt-5 pb-2 text-sm text-white outline-none transition-all duration-200 ${
                      errors[f.key] ? "border-red-500" : "border-white/[0.08] focus:border-red-500/50"
                    }`}
                  />
                  <label htmlFor={f.key} className="absolute left-4 top-1.5 text-[10px] text-zinc-600 transition-all peer-focus:text-red-400">
                    {f.label} <span className="text-red-500">*</span>
                  </label>
                  {errors[f.key] && <p className="mt-1 text-[10px] text-red-400">{errors[f.key]}</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="py-5">
            <div className="space-y-3 text-sm mb-5">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">{data.packageName}</span>
                <span className="text-white font-medium">GHC {data.packagePrice.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Sound Edit</span>
                <span className="text-white font-medium">{data.soundFee > 0 ? `GHC ${data.soundFee}` : "Free"}</span>
              </div>
              <div className="border-t border-white/[0.04] pt-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-white">Total</span>
                <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600">GHC {data.total.toLocaleString()}</span>
              </div>
            </div>

            <div className="text-[10px] text-zinc-600 space-y-1.5 mb-5">
              <p>• Payment verified within 24 hours</p>
              <p>• WhatsApp confirmation sent</p>
              <p>• Campaign starts after verification</p>
            </div>

            <motion.button
              type="submit"
              disabled={submitting}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold text-base transition-all duration-200 disabled:opacity-60 shadow-lg shadow-red-500/20 touch-target"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Submitting...
                </span>
              ) : "Submit Campaign"}
            </motion.button>
          </div>
        </motion.form>
      </main>
    </div>
  );
}

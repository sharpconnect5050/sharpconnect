"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

interface PaymentData {
  reference: string;
  campaignId: string;
  amount: number;
  status: string;
  date: string;
  artistName: string;
  songTitle: string;
  packageName: string;
  soundOption: string;
  email: string;
}

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7"];

function generateConfetti() {
  const particles = [];
  for (let i = 0; i < 80; i++) {
    particles.push({
      id: i,
      x: Math.random() * 100,
      y: -10 - Math.random() * 20,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 4 + Math.random() * 8,
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 3,
      drift: (Math.random() - 0.5) * 20,
    });
  }
  return particles;
}

export default function SuccessPage() {
  const [data, setData] = useState<PaymentData | null>(null);
  const [copied, setCopied] = useState(false);
  const [particles] = useState(generateConfetti);

  useEffect(() => {
    const raw = sessionStorage.getItem("sharpconnect_submitted") || sessionStorage.getItem("sharpconnect_payment");
    if (!raw) {
      window.location.href = "/campaign";
      return;
    }
    try { setData(JSON.parse(raw)); } catch { window.location.href = "/campaign"; }
  }, []);

  const handleCopyId = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.campaignId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = data.campaignId;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadReceipt = () => {
    if (!data) return;
    const lines = [
      "SHARPCONNECT TEMPLATE PROMO",
      "━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      "CAMPAIGN RECEIPT",
      "━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      `Campaign ID: ${data.campaignId}`,
      `Transaction Ref: ${data.reference}`,
      `Date: ${new Date(data.date).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })}`,
      `Status: PAID`,
      "",
      "━━━━━━━━━━━━━━━━━━━━━━━━",
      "ARTIST INFORMATION",
      `Artist: ${data.artistName}`,
      `Song: ${data.songTitle}`,
      `Email: ${data.email}`,
      "",
      "PACKAGE DETAILS",
      `Package: ${data.packageName}`,
      `Amount Paid: GHC ${data.amount.toLocaleString()}`,
      "",
      "━━━━━━━━━━━━━━━━━━━━━━━━",
      "Turnaround: 24-48 hours",
      "Support: sharpconnect@email.com",
      "━━━━━━━━━━━━━━━━━━━━━━━━",
    ].join("\n");

    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SharpConnect-Receipt-${data.campaignId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const turnaround =
    data.packageName === "Promo + Edited Sound" ? "24 hours" : "48 hours";

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
          }}
          animate={{
            y: [0, 1100],
            x: [0, p.drift],
            rotate: [0, 360],
            opacity: [1, 0.8, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}

      <header className="relative z-10 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center font-bold text-xs">
              S
            </div>
            <span className="font-semibold text-sm hidden sm:block">
              SharpConnect
            </span>
          </a>
        </div>
      </header>

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center mb-10"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
            className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mb-6 shadow-lg shadow-green-500/20"
          >
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </motion.div>

          <h1 className="text-3xl sm:text-4xl font-bold">
            Campaign Submitted{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
              Successfully
            </span>
          </h1>
          <p className="mt-3 text-zinc-400 text-sm sm:text-base">
            Your campaign is now in the SharpConnect production queue.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 sm:p-8 mb-6"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
                Campaign ID
              </p>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono text-red-400 bg-red-500/10 px-2 py-1 rounded-md">
                  {data.campaignId}
                </code>
                <button
                  onClick={handleCopyId}
                  className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
                  title="Copy Campaign ID"
                >
                  {copied ? (
                    <svg
                      className="w-4 h-4 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4 text-zinc-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
                Payment Status
              </p>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-medium text-green-400">Paid</span>
              </div>
            </div>

            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
                Submission Date
              </p>
              <p className="text-sm text-white">
                {new Date(data.date).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>

            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
                Estimated Turnaround
              </p>
              <p className="text-sm text-white">{turnaround}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 sm:p-8 mb-6"
        >
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
            What happens next?
          </h3>
          <ol className="space-y-3">
            {[
              "Our team reviews your campaign details and audio file.",
              "We create a custom CapCut template matching your creative direction.",
              "The template goes live across our TikTok promotion network.",
              "You receive a tracking report with performance metrics.",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-zinc-300">
                <span className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <button
            onClick={handleDownloadReceipt}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl border border-white/20 text-white font-medium text-sm hover:bg-white/5 transition-all"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Download Receipt
          </button>
          <a
            href="/"
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-medium text-sm transition-all shadow-lg shadow-red-500/20"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            Track Campaign
          </a>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-8 text-center text-xs text-zinc-600"
        >
          A confirmation has been sent to{" "}
          <span className="text-zinc-400">{data.email}</span>
          {data.soundOption !== "original" && (
            <>
              {" "}and a WhatsApp message to your number.
            </>
          )}
        </motion.p>
      </div>
    </div>
  );
}

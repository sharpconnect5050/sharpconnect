"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const CLEARED_KEYS = [
  "sharpconnect_submissions",
  "sharpconnect_activity_log",
  "sharpconnect_notifications",
  "sharpconnect_events",
  "sharpconnect_schedules",
  "sharpconnect_review_history",
  "sharpconnect_review_comments",
  "sharpconnect_review_tokens",
  "sharpconnect_artist_reviews",
  "sharpconnect_artist_notifications",
  "sharpconnect_editor_submissions",
  "sharpconnect_assignments",
  "sharpconnect_editor_assignments",
  "sharpconnect_tasks",
  "sharpconnect_editor_tasks",
  "sharpconnect_post_submission_tasks",
  "sharpconnect_post_performance",
  "sharpconnect_uploads",
  "sharpconnect_submissions_history",
  "sharpconnect_admin_reviews",
  "sharpconnect_notification_logs",
  "sharpconnect_test_mode",
  "sharpconnect_automation",
];

const PRESERVED_KEYS = [
  "sharpconnect_notification_preferences",
  "sharpconnect_dispatch_enabled",
  "sharpconnect_dispatch_channel_telegram",
  "sharpconnect_dispatch_channel_email",
  "sharpconnect_admin_telegram_chat_id",
  "sharpconnect_admin",
  "sharpconnect_admin_role",
];

interface TableResult {
  deleted: number;
  ok: boolean;
}

interface ResetResponse {
  success: boolean;
  results: Record<string, TableResult>;
  totalDeleted: number;
  note: string;
}

type Step = "idle" | "confirm" | "executing" | "done" | "error";

export default function ResetTool() {
  const [step, setStep] = useState<Step>("idle");
  const [confirmText, setConfirmText] = useState("");
  const [response, setResponse] = useState<ResetResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleReset = useCallback(async () => {
    setStep("executing");
    setErrorMsg("");

    try {
      const token = sessionStorage.getItem("sharpconnect_admin");
      const res = await fetch("/api/admin/reset-operational-data", {
        method: "POST",
        headers: { Authorization: token ?? "", "Content-Type": "application/json" },
      });
      const data: ResetResponse & { errors?: string[] } = await res.json();

      if (!res.ok || !data.success) {
        setResponse(data);
        setErrorMsg(data.errors?.join("; ") || data.note || `Server returned ${res.status}`);
        setStep("error");
        return;
      }

      // Clear localStorage operational keys
      for (const key of CLEARED_KEYS) {
        localStorage.removeItem(key);
      }
      // Also clear version history keys
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k?.startsWith("sharpconnect_versions_")) localStorage.removeItem(k);
      }

      setResponse(data);
      setStep("done");

      setTimeout(() => window.location.reload(), 2500);
    } catch {
      setErrorMsg("Network error — check your connection and try again.");
      setStep("error");
    }
  }, []);

  const resetStep = useCallback(() => {
    setStep("idle");
    setConfirmText("");
    setResponse(null);
    setErrorMsg("");
  }, []);

  const totalPreservedFields = [...PRESERVED_KEYS, "storage buckets", "editor profiles", "Supabase schema", "Telegram integration", "TikTok config", "env vars"].length;

  return (
    <>
      {/* Trigger button */}
      {step === "idle" && (
        <button
          onClick={() => setStep("confirm")}
          className="w-full px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/[0.04] text-red-400 text-xs font-semibold hover:bg-red-500/[0.08] hover:border-red-500/30 transition-all active:scale-[0.98]"
        >
          Reset Operational Data
        </button>
      )}

      {/* Confirmation modal */}
      <AnimatePresence>
        {(step === "confirm" || step === "executing") && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overscroll-contain"
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={step === "executing" ? undefined : resetStep} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg rounded-2xl border border-white/[0.08] bg-zinc-950 p-6 shadow-2xl max-h-[90vh] overflow-y-auto overscroll-contain"
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>

              <h3 className="text-lg font-bold text-center text-zinc-100 mb-2">Reset Operational Data</h3>

              {step === "confirm" && (
                <>
                  <p className="text-sm text-zinc-500 text-center mb-5">
                    This will permanently delete all test/demo operational data. Schema and configuration will not be affected.
                  </p>

                  {/* What will be deleted */}
                  <div className="mb-4 p-3 rounded-xl bg-red-500/[0.04] border border-red-500/10">
                    <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-2">Will be deleted</p>
                    <ul className="space-y-1">
                      {["All campaigns & submissions", "Activity logs & events", "Notifications & alerts",
                        "Payments & financial records", "Schedules & posting records",
                        "Reviews, comments & tokens", "Editor assignments & submissions",
                        "Upload/media references", "All localStorage test data",
                      ].map((item) => (
                        <li key={item} className="text-[11px] text-red-300/80 flex items-center gap-1.5">
                          <svg className="w-3 h-3 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* What will be preserved */}
                  <div className="mb-5 p-3 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/10">
                    <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-2">Preserved</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {["Supabase schema", "Storage buckets", "Editor profiles", "Admin accounts",
                        "Telegram integration", "TikTok config", "Notification preferences",
                        "Dispatch settings", "Environment variables",
                      ].map((item) => (
                        <span key={item} className="text-[11px] text-emerald-300/80 flex items-center gap-1">
                          <svg className="w-3 h-3 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Confirmation input */}
                  <p className="text-xs text-zinc-600 mb-2">
                    Type <span className="font-mono font-bold text-zinc-400">RESET</span> to confirm:
                  </p>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Type RESET to confirm"
                    className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-red-500/40 focus:ring-1 focus:ring-red-500/20 transition-all mb-5"
                    autoFocus
                  />

                  <div className="flex gap-3">
                    <button
                      onClick={resetStep}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-white/[0.06] text-xs text-zinc-400 hover:text-zinc-300 hover:bg-white/[0.03] transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleReset}
                      disabled={confirmText !== "RESET"}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      Execute Reset
                    </button>
                  </div>
                </>
              )}

              {step === "executing" && (
                <div className="py-8 text-center">
                  <div className="w-8 h-8 border-2 border-red-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-zinc-400">Clearing operational data...</p>
                  <p className="text-[11px] text-zinc-600 mt-1">This may take a few seconds</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* Result modal */}
        {(step === "done" || step === "error") && response && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg rounded-2xl border border-white/[0.08] bg-zinc-950 p-6 shadow-2xl"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 ${step === "done" ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
                {step === "done" ? (
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01" />
                  </svg>
                )}
              </div>

              <h3 className={`text-lg font-bold text-center mb-1 ${step === "done" ? "text-emerald-300" : "text-red-300"}`}>
                {step === "done" ? "Reset Complete" : "Reset Failed"}
              </h3>

              <p className="text-sm text-zinc-500 text-center mb-4">{response.note}</p>

              {/* Results table */}
              <div className="max-h-48 overflow-y-auto custom-scrollbar mb-4 space-y-0.5">
                {response.results && Object.entries(response.results).length > 0 ? (
                  Object.entries(response.results).map(([table, result]) => (
                    <div key={table} className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-white/[0.02]">
                      <span className="text-[11px] text-zinc-400 font-mono">{table}</span>
                      <span className={`text-[11px] font-mono ${result.ok ? "text-emerald-400" : "text-red-400"}`}>
                        {result.ok ? `${result.deleted} rows` : "error"}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] text-zinc-600 text-center py-2">No table results returned</p>
                )}
              </div>

              {step === "error" && errorMsg && (
                <p className="text-[11px] text-red-400 text-center mb-4">{errorMsg}</p>
              )}

              <button
                onClick={resetStep}
                className="w-full px-4 py-2.5 rounded-xl border border-white/[0.06] text-xs text-zinc-400 hover:text-zinc-300 hover:bg-white/[0.03] transition-all"
              >
                {step === "done" ? "Reloading..." : "Close"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

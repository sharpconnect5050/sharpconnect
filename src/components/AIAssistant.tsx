"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { buildOperationalContext, formatContextForAI, type OperationalContext, type OperationalAlert } from "@/lib/operational-context";
import { markAllAsRead } from "@/lib/notifications";

/* ─── TYPES ───────────────────────────────────────────────── */

interface Message {
  role: "user" | "assistant";
  text: string;
}

type CopilotTab = "feed" | "chat";

const QUICK_PROMPTS = [
  "What needs attention today?",
  "Which payments are pending?",
  "Overdue campaigns?",
  "Today's posts?",
  "Editor workload?",
  "Campaigns needing revision?",
];

const PRIORITY_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string; border: string }> = {
  critical: {
    label: "Critical", icon: "🔴",
    color: "text-red-400", bg: "bg-red-500/[0.06]", border: "border-red-500/20",
  },
  warning: {
    label: "Warning", icon: "🟡",
    color: "text-amber-400", bg: "bg-amber-500/[0.06]", border: "border-amber-500/20",
  },
  normal: {
    label: "Normal", icon: "🔵",
    color: "text-blue-400", bg: "bg-blue-500/[0.06]", border: "border-blue-500/20",
  },
  info: {
    label: "Info", icon: "⚪",
    color: "text-zinc-400", bg: "bg-white/[0.03]", border: "border-white/[0.06]",
  },
};

/* ─── COMPONENT ───────────────────────────────────────────── */

export default function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<CopilotTab>("feed");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(true);
  const [context, setContext] = useState<OperationalContext | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [pulse, setPulse] = useState(false);
  const [mounted, setMounted] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevAlertCountRef = useRef(0);

  // Mount state for animations
  useEffect(() => { setMounted(true); }, []);

  // Build context and poll
  const refreshContext = useCallback(() => {
    const ctx = buildOperationalContext();
    setContext(ctx);

    const count = ctx.alerts.length;
    if (count > prevAlertCountRef.current && prevAlertCountRef.current > 0) {
      setPulse(true);
      setTimeout(() => setPulse(false), 1500);
    }
    prevAlertCountRef.current = count;
  }, []);

  let mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  useEffect(() => {
    refreshContext();
    if (!polling) return;
    const interval = setInterval(refreshContext, 30000);
    return () => clearInterval(interval);
  }, [refreshContext, polling]);

  // Scroll on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Reset dismissed when context regenerates
  useEffect(() => {
    if (context) {
      const validIds = new Set(context.alerts.map((a) => a.id));
      setDismissedAlerts((prev) => {
        const next = new Set(prev);
        for (const id of next) if (!validIds.has(id)) next.delete(id);
        return next;
      });
    }
  }, [context]);

  const activeAlerts = useMemo(() => {
    if (!context) return [];
    return context.alerts.filter((a) => !dismissedAlerts.has(a.id));
  }, [context, dismissedAlerts]);

  const criticalCount = useMemo(() =>
    activeAlerts.filter((a) => a.priority === "critical").length,
  [activeAlerts]);

  const warningCount = useMemo(() =>
    activeAlerts.filter((a) => a.priority === "warning").length,
  [activeAlerts]);

  const totalAlertCount = useMemo(() => activeAlerts.length, [activeAlerts]);

  const dismissAlert = (id: string) => {
    setDismissedAlerts((prev) => new Set(prev).add(id));
  };

  const dismissAllAlerts = () => {
    setDismissedAlerts(new Set(activeAlerts.map((a) => a.id)));
    markAllAsRead();
  };

  const send = async (query: string) => {
    if (!query.trim()) return;
    const userMsg: Message = { role: "user", text: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // If context is not yet built, build it
    const ctx = context || buildOperationalContext();
    const aiContext = formatContextForAI(ctx);

    setLoading(true);
    try {
      const adminToken = typeof window !== "undefined" ? sessionStorage.getItem("sharpconnect_admin") : null;
      const res = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(adminToken ? { Authorization: adminToken } : {}) },
        body: JSON.stringify({ context: aiContext, query }),
      });
      const data = await res.json();
      const reply: Message = { role: "assistant", text: data.response || data.error || "No response" };
      setMessages((prev) => [...prev, reply]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "Failed to reach AI assistant." }]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const alertCard = (alert: OperationalAlert) => {
    const cfg = PRIORITY_CONFIG[alert.priority] || PRIORITY_CONFIG.info;
    return (
      <motion.div
        key={alert.id}
        layout
        initial={{ opacity: 0, x: -10, height: 0 }}
        animate={{ opacity: 1, x: 0, height: "auto" }}
        exit={{ opacity: 0, x: 10, height: 0 }}
        className={`rounded-xl border ${cfg.border} ${cfg.bg} p-3 relative overflow-hidden`}
      >
        <div className="flex items-start gap-2.5">
          <span className="text-xs mt-0.5 shrink-0">{cfg.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${cfg.color}`}>
                {cfg.label}
              </span>
              {alert.campaignId && (
                <code className="text-[8px] font-mono text-zinc-600 bg-white/[0.04] px-1 py-0.5 rounded">
                  {alert.campaignId}
                </code>
              )}
            </div>
            <p className="text-xs text-zinc-300 mt-1 leading-relaxed">{alert.message}</p>
          </div>
          <button onClick={() => dismissAlert(alert.id)}
            className="text-zinc-600 hover:text-zinc-400 shrink-0 mt-0.5 transition-colors p-0.5"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </motion.div>
    );
  };

  if (!mounted) return null;

  return (
    <>
      {/* ─── FLOATING BUTTON ─── */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-20 lg:bottom-6 right-4 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-red-600 to-red-800 text-white shadow-lg shadow-red-900/40 hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
        aria-label="Operations Copilot"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>

        {/* Badge */}
        {totalAlertCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={`absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full text-[9px] font-bold text-white flex items-center justify-center px-1 ${
              criticalCount > 0 ? "bg-red-600" : warningCount > 0 ? "bg-amber-500" : "bg-blue-500"
            } ${pulse ? "animate-pulse-urgent" : ""}`}
          >
            {totalAlertCount > 9 ? "9+" : totalAlertCount}
          </motion.span>
        )}

        {/* Live dot */}
        <span className="absolute -bottom-0.5 -left-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse-urgent" />
      </button>

      {/* ─── PANEL ─── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-36 lg:bottom-20 right-4 z-50 w-[calc(100vw-2rem)] sm:w-[420px] max-h-[80vh] flex flex-col rounded-2xl border border-white/[0.08] bg-[#050505]/95 backdrop-blur-2xl shadow-2xl shadow-black/60 overflow-hidden"
          >
            {/* ── HEADER ── */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-[8px] font-bold text-white overflow-hidden">
                  <div className="absolute inset-0 bg-[linear-gradient(105deg,transparent_30%,rgba(255,255,255,0.12)_50%,transparent_70%)]" />
                  <span className="relative z-10">CP</span>
                  {criticalCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-pulse-urgent" />
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Operations Copilot</div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1 h-1 rounded-full ${criticalCount > 0 ? "bg-red-500 animate-pulse-urgent" : "bg-emerald-500"}`} />
                    <span className={`text-[9px] font-medium ${criticalCount > 0 ? "text-red-400" : "text-emerald-400"}`}>
                      {criticalCount > 0
                        ? `${criticalCount} critical`
                        : warningCount > 0
                          ? `${warningCount} warning${warningCount !== 1 ? "s" : ""}`
                          : "All clear"}
                    </span>
                    {totalAlertCount > 0 && (
                      <span className="text-[9px] text-zinc-600">· {totalAlertCount} total</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Refresh */}
                <button onClick={refreshContext} className="p-1.5 text-zinc-600 hover:text-white transition-colors rounded-lg hover:bg-white/[0.04]">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button onClick={() => setOpen(false)} className="p-1.5 text-zinc-600 hover:text-white transition-colors rounded-lg hover:bg-white/[0.04]">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* ── TAB BAR ── */}
            <div className="flex gap-1 mx-3 mt-2 p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
              {(["feed", "chat"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-medium transition-all ${
                    tab === t ? "bg-red-600/20 text-red-300 border border-red-500/20" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {t === "feed" ? (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  )}
                  {t === "feed" ? `Feed (${totalAlertCount})` : "Chat"}
                </button>
              ))}
            </div>

            {/* ── BODY ── */}
            <div className="flex-1 overflow-y-auto min-h-[300px] max-h-[400px]">
              {/* ── FEED TAB ── */}
              {tab === "feed" && (
                <div className="p-3 space-y-2">
                  {activeAlerts.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-sm text-zinc-500 font-medium">All Clear</p>
                      <p className="text-xs text-zinc-600 mt-1">No operational issues detected.</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-zinc-600 uppercase tracking-wider">
                          {criticalCount > 0 ? `${criticalCount} critical · ` : ""}{activeAlerts.length} alert{activeAlerts.length !== 1 ? "s" : ""}
                        </span>
                        <button onClick={dismissAllAlerts} className="text-[9px] text-zinc-600 hover:text-zinc-400 transition-colors">
                          Dismiss all
                        </button>
                      </div>
                      <AnimatePresence mode="popLayout">
                        {activeAlerts.map(alertCard)}
                      </AnimatePresence>
                    </>
                  )}
                </div>
              )}

              {/* ── CHAT TAB ── */}
              {tab === "chat" && (
                <div className="p-3 space-y-3">
                  {messages.length === 0 && (
                    <div className="space-y-3">
                      <p className="text-xs text-zinc-600 text-center pt-4">Ask the Copilot about your operations. Uses live dashboard data.</p>
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {QUICK_PROMPTS.map((p) => (
                          <button key={p} onClick={() => send(p)}
                            className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/5 text-[10px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.08] transition-all"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <AnimatePresence initial={false}>
                    {messages.map((msg, i) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                          msg.role === "user"
                            ? "bg-red-600/15 text-red-200 border border-red-500/10"
                            : "bg-white/[0.04] text-zinc-300 border border-white/5"
                        }`}>
                          {msg.text}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-white/[0.04] border border-white/5 rounded-2xl px-3.5 py-2.5 text-xs text-zinc-600">
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce" style={{ animationDelay: "0ms" }} />
                          <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce" style={{ animationDelay: "150ms" }} />
                          <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={endRef} />
                </div>
              )}
            </div>

            {/* ── INPUT (chat only) ── */}
            {tab === "chat" && (
              <div className="border-t border-white/[0.06] p-3">
                <div className="flex items-center gap-2">
                  <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
                    placeholder="Ask about operations..."
                    className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-700 outline-none focus:border-red-500/30"
                  />
                  <button onClick={() => send(input)} disabled={loading || !input.trim()}
                    className="p-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-30 text-white transition-all shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { getAutomationSettings, updateAutomationSettings } from "@/lib/workflows";
import { getEventLogs } from "@/lib/events";
import { getAllNotifications } from "@/lib/notifications";
import ResetTool from "@/components/ResetTool";

const toggles = [
  { key: "autoAssignEditor" as const, label: "Auto-Assign Editor", desc: "Automatically assign the least-loaded editor when payment is approved." },
  { key: "autoStartCampaign" as const, label: "Auto-Start Campaign", desc: "Move campaign to 'Editing' immediately after payment approval." },
  { key: "sendClientNotifications" as const, label: "Client Notifications", desc: "Send email & WhatsApp notifications to clients at each stage." },
  { key: "addAdminNotifications" as const, label: "Internal Alerts", desc: "Notify the team via internal channels for key events." },
  { key: "autoOfferUpsell" as const, label: "Auto Upsell Offer", desc: "Include a repost boost offer in completion emails." },
];

export default function AutomationPage() {
  const [settings, setSettings] = useState({
    autoAssignEditor: true,
    autoStartCampaign: true,
    sendClientNotifications: true,
    addAdminNotifications: true,
    autoOfferUpsell: true,
  });
  const [eventCount, setEventCount] = useState(0);
  const [notifCount, setNotifCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      getAutomationSettings().then((s) => { if (mounted) setSettings(s); }),
      getEventLogs().then((logs) => { if (mounted) setEventCount(logs.length); }),
      getAllNotifications().then((notifs) => { if (mounted) setNotifCount(notifs.length); }),
    ]).catch(console.error).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const toggle = async (key: keyof typeof settings) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    await updateAutomationSettings({ [key]: next[key] });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Automation</h1>
        <p className="text-sm text-zinc-500 mt-1">Control automated workflows and notifications</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Events Logged", value: eventCount, color: "from-blue-500 to-blue-600" },
          { label: "Notifications Sent", value: notifCount, color: "from-green-500 to-green-600" },
          { label: "Active Automations", value: Object.values(settings).filter(Boolean).length, color: "from-purple-500 to-purple-600" },
          { label: "Total Automations", value: toggles.length, color: "from-zinc-500 to-zinc-600" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-4"
          >
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${s.color}`}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6"
      >
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-6">Automation Toggles</h3>
        <div className="space-y-4">
          {toggles.map((t) => (
            <div key={t.key} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
              <div>
                <p className="text-sm font-medium text-white">{t.label}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{t.desc}</p>
              </div>
              <button
                onClick={() => toggle(t.key)}
                className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
                  settings[t.key] ? "bg-red-600" : "bg-zinc-700"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all duration-300 ${
                    settings[t.key] ? "left-6" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6"
      >
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Workflow Rules</h3>
        <div className="space-y-3 text-sm">
          {[
            { event: "Payment Approved", action: "→ Update status to Paid, assign editor (auto), notify client, move to Editing", active: settings.autoAssignEditor && settings.autoStartCampaign },
            { event: "Status → Editing", action: "→ Notify client that campaign has started", active: settings.sendClientNotifications },
            { event: "Status → Completed", action: "→ Send completion email with upsell offer, log analytics", active: settings.sendClientNotifications },
            { event: "Payment Rejected", action: "→ Log event, send internal alert", active: settings.addAdminNotifications },
            { event: "Error Occurs", action: "→ Log error, send internal error alert, admin fallback available", active: true },
          ].map((rule, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-black/30">
              <div className={`w-2 h-2 rounded-full mt-1.5 ${rule.active ? "bg-green-500" : "bg-zinc-600"}`} />
              <div>
                <p className="text-white font-medium text-xs">{rule.event}</p>
                <p className="text-zinc-500 text-xs mt-0.5">{rule.action}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ─── DANGER ZONE ─────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl border border-red-500/10 bg-red-500/[0.02] p-6"
      >
        <div className="flex items-center gap-2.5 mb-1">
          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider">Danger Zone</h3>
        </div>
        <p className="text-[11px] text-zinc-600 mb-4">
          Permanently delete all operational test data. Schema, integrations, and configuration are preserved.
        </p>
        <ResetTool />
      </motion.div>
    </div>
  );
}

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getNotificationPreferences, saveNotificationPreferences,
  resetNotificationPreferences, getTypesByGroup,
  getGroupEnabledCount, setGroupPreference,
  NOTIFICATION_TYPE_META,
  type NotificationPreferences,
} from "@/lib/notification-preferences";
import {
  getDispatchEnabled, setDispatchEnabled,
  getDispatchChannelEnabled, setDispatchChannelEnabled,
  getAdminTelegramChatId, setAdminTelegramChatId,
} from "@/lib/notification-dispatch";
import { GROUP_META, getNotificationGroupColor } from "@/lib/notifications";
import type { NotificationGroup } from "@/lib/notifications";

/* ─── TOGGLE SWITCH (modern) ─────────────────────────────── */

function Toggle({ enabled, onChange, id }: { enabled: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={`relative w-9 h-5 rounded-full transition-all duration-300 shrink-0 ${
        enabled
          ? "bg-gradient-to-r from-red-600 to-red-500 shadow-[0_0_8px_rgba(239,68,68,0.25)]"
          : "bg-white/[0.07] hover:bg-white/[0.1]"
      }`}
    >
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={`absolute top-0.5 w-4 h-4 rounded-full transition-colors ${
          enabled ? "bg-white left-[18px]" : "bg-zinc-500 left-0.5"
        }`}
      />
    </button>
  );
}

/* ─── PROGRESS BAR ───────────────────────────────────────── */

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className={`h-full rounded-full ${
          pct === 100
            ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
            : pct > 50
            ? "bg-gradient-to-r from-amber-500 to-amber-400"
            : "bg-gradient-to-r from-red-600 to-orange-500"
        }`}
      />
    </div>
  );
}

/* ─── GROUP SECTION ──────────────────────────────────────── */

function GroupSection({ group, search }: { group: NotificationGroup; search: string }) {
  const meta = GROUP_META[group];
  const types = getTypesByGroup(group);
  const [prefs, setPrefs] = useState(getNotificationPreferences());
  const [collapsed, setCollapsed] = useState(false);

  const refresh = useCallback(() => {
    setPrefs(getNotificationPreferences());
  }, []);

  const { enabled, total } = useMemo(() => getGroupEnabledCount(group), [prefs, group]);

  const filteredTypes = useMemo(() => {
    if (!search.trim()) return types;
    const q = search.toLowerCase();
    return types.filter(
      (t) => t.label.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );
  }, [types, search]);

  const handleToggle = (type: string, value: boolean) => {
    const next = { ...prefs, [type]: value };
    setPrefs(next);
    saveNotificationPreferences(next);
  };

  const handleGroupToggle = (value: boolean) => {
    const next = setGroupPreference(group, value);
    setPrefs(next);
  };

  if (types.length === 0) return null;
  if (search && filteredTypes.length === 0) return null;

  return (
    <div className="border-b border-white/[0.04] last:border-b-0">
      {/* Group header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs shrink-0 border transition-colors ${getNotificationGroupColor(group)}`}>
          {meta.icon}
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-300">{meta.label}</span>
            <span className={`text-[9px] font-mono tabular-nums px-1.5 py-0.5 rounded-full ${
              enabled === total ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-500/10 text-zinc-500"
            }`}>
              {enabled}/{total}
            </span>
          </div>
          {/* Mini progress bar */}
          <div className="mt-1.5 w-24">
            <ProgressBar value={enabled} max={total} />
          </div>
        </div>
        <motion.svg
          animate={{ rotate: collapsed ? 0 : 180 }}
          transition={{ duration: 0.2 }}
          className="w-3 h-3 text-zinc-700 shrink-0"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            {/* Group-level actions */}
            <div className="flex items-center gap-2 px-4 pb-2">
              {enabled !== total && (
                <button
                  onClick={() => handleGroupToggle(true)}
                  className="text-[9px] font-medium text-emerald-500 hover:text-emerald-400 transition-colors"
                >
                  Enable all
                </button>
              )}
              {enabled > 0 && (
                <button
                  onClick={() => handleGroupToggle(false)}
                  className="text-[9px] font-medium text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  Disable all
                </button>
              )}
            </div>

            {/* Type rows */}
            <div className="space-y-0.5 pb-2">
              {filteredTypes.length === 0 && search && (
                <p className="text-[10px] text-zinc-700 text-center py-4">No matching notification types</p>
              )}
              {filteredTypes.map((t) => (
                <motion.div
                  key={t.type}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 px-4 py-2 mx-1 rounded-xl hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-sm w-5 text-center shrink-0">{t.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-zinc-300">{t.label}</p>
                    <p className="text-[9px] text-zinc-600 truncate leading-relaxed">{t.description}</p>
                  </div>
                  <Toggle
                    enabled={prefs[t.type] !== false}
                    onChange={(v) => handleToggle(t.type, v)}
                    id={`pref-${t.type}`}
                  />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── DISPATCH SETTINGS ──────────────────────────────────── */

function DispatchSettings() {
  const [dispatchEnabled, setDispatchEnabledState] = useState(getDispatchEnabled());
  const [telegramEnabled, setTelegramEnabledState] = useState(getDispatchChannelEnabled("telegram"));
  const [emailEnabled, setEmailEnabledState] = useState(getDispatchChannelEnabled("email"));
  const [adminChatId, setAdminChatIdState] = useState(getAdminTelegramChatId());
  const [chatIdInput, setChatIdInput] = useState(adminChatId);
  const [saved, setSaved] = useState(false);

  const showSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleDispatchToggle = (v: boolean) => {
    setDispatchEnabledState(v);
    setDispatchEnabled(v);
    showSaved();
  };

  const handleTelegramToggle = (v: boolean) => {
    setTelegramEnabledState(v);
    setDispatchChannelEnabled("telegram", v);
    showSaved();
  };

  const handleEmailToggle = (v: boolean) => {
    setEmailEnabledState(v);
    setDispatchChannelEnabled("email", v);
    showSaved();
  };

  const handleChatIdSave = () => {
    const trimmed = chatIdInput.trim();
    setAdminChatIdState(trimmed);
    setAdminTelegramChatId(trimmed);
    showSaved();
  };

  return (
    <div className="border-b border-white/[0.04]">
      <div className="px-4 py-3.5">
        {/* Section header */}
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-sky-500/15 to-blue-500/10 border border-sky-500/20 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-zinc-300">Dispatch Channels</span>
            <p className="text-[8px] text-zinc-700">Telegram &amp; email outbound notifications</p>
          </div>
        </div>

        <div className="space-y-2.5">
          {/* Master toggle */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-zinc-300 font-medium">Outbound dispatch</p>
              <p className="text-[8px] text-zinc-600">Send alerts via Telegram and email</p>
            </div>
            <Toggle enabled={dispatchEnabled} onChange={handleDispatchToggle} id="dispatch-master" />
          </div>

          {dispatchEnabled && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              className="space-y-2 overflow-hidden"
            >
              {/* Telegram toggle */}
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3 h-3 text-[#0088cc]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                    </svg>
                    <p className="text-[10px] text-zinc-300 font-medium">Telegram</p>
                  </div>
                  <p className="text-[8px] text-zinc-600 mt-0.5">Bot messages to admin group</p>
                </div>
                <Toggle enabled={telegramEnabled} onChange={handleTelegramToggle} id="dispatch-telegram" />
              </div>

              {/* Chat ID input */}
              {telegramEnabled && (
                <div className="pl-3 pr-3 pb-1">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={chatIdInput}
                      onChange={(e) => setChatIdInput(e.target.value)}
                      placeholder="Chat ID (e.g. -5272272330)"
                      className="flex-1 bg-transparent border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-[10px] text-zinc-300 placeholder-zinc-700 outline-none focus:border-sky-500/50 transition-colors font-mono"
                    />
                    {chatIdInput !== adminChatId && (
                      <button onClick={handleChatIdSave}
                        className="px-2.5 py-1.5 rounded-lg bg-sky-600/20 border border-sky-500/30 text-[9px] text-sky-400 font-medium hover:bg-sky-600/30 transition-colors"
                      >
                        Save
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <div className={`w-1 h-1 rounded-full ${adminChatId ? "bg-emerald-500" : "bg-amber-500"}`} />
                    <span className="text-[7px] text-zinc-700">
                      {adminChatId
                        ? `Dispatching to chat ${adminChatId}`
                        : "Using TELEGRAM_STORAGE_CHAT_ID from env"
                      }
                    </span>
                  </div>
                </div>
              )}

              {/* Email toggle */}
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    <p className="text-[10px] text-zinc-300 font-medium">Email</p>
                    <span className="text-[7px] text-zinc-700 font-mono">sharpconnectinfo@gmail.com</span>
                  </div>
                  <p className="text-[8px] text-zinc-600 mt-0.5">SMTP dispatch via Gmail</p>
                </div>
                <Toggle enabled={emailEnabled} onChange={handleEmailToggle} id="dispatch-email" />
              </div>
            </motion.div>
          )}
        </div>

        {/* Saved indicator */}
        <AnimatePresence>
          {saved && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-[9px] text-emerald-400 text-center mt-2"
            >
              Preferences saved
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ─── PREFERENCES PANEL ──────────────────────────────────── */

interface NotificationPreferencesPanelProps {
  onBack: () => void;
}

export default function NotificationPreferencesPanel({ onBack }: NotificationPreferencesPanelProps) {
  const [prefs, setPrefs] = useState(getNotificationPreferences());
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState("");

  const totalEnabled = useMemo(
    () => NOTIFICATION_TYPE_META.filter((t) => prefs[t.type] !== false).length,
    [prefs],
  );
  const totalTypes = NOTIFICATION_TYPE_META.length;

  const groups: NotificationGroup[] = ["workflow", "revision", "scheduling", "payment", "artist", "ai", "other"];

  const handleReset = () => {
    const defaults = resetNotificationPreferences();
    setPrefs(defaults);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleEnableAll = () => {
    const next: NotificationPreferences = {};
    for (const meta of NOTIFICATION_TYPE_META) {
      next[meta.type] = true;
    }
    setPrefs(next);
    saveNotificationPreferences(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-all -ml-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="text-sm font-semibold text-white">Preferences</h3>
        </div>
        <span className={`text-[9px] font-mono tabular-nums px-1.5 py-0.5 rounded-full ${
          totalEnabled === totalTypes ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-500/10 text-zinc-500"
        }`}>
          {totalEnabled}/{totalTypes}
        </span>
      </div>

      {/* Progress + actions bar */}
      <div className="px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.04] shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-zinc-500 font-medium">
              {totalEnabled === totalTypes
                ? "All notification types enabled"
                : `${totalTypes - totalEnabled} type${totalTypes - totalEnabled > 1 ? "s" : ""} disabled`
              }
            </p>
            <div className="mt-1.5">
              <ProgressBar value={totalEnabled} max={totalTypes} />
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {totalEnabled < totalTypes && (
              <button onClick={handleEnableAll}
                className="px-2 py-1 rounded-md text-[9px] font-medium bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-500/20 transition-all"
              >
                Enable all
              </button>
            )}
            <button onClick={handleReset}
              className="px-2 py-1 rounded-md text-[9px] font-medium text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04] border border-white/[0.06] transition-all"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-700 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter notification types..."
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pl-7 pr-2.5 py-1.5 text-[10px] text-zinc-300 placeholder-zinc-700 outline-none focus:border-zinc-500/50 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-700 hover:text-zinc-500 transition-colors">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Dispatch Settings */}
      <DispatchSettings />

      {/* Groups */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {groups.map((group) => (
          <GroupSection key={group} group={group} search={search} />
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-white/[0.04] shrink-0">
        <AnimatePresence>
          {saved && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-[9px] text-emerald-400 text-center"
            >
              Preferences saved
            </motion.p>
          )}
        </AnimatePresence>
        <p className="text-[7px] text-zinc-700 text-center mt-1">
          Changes apply immediately to new and existing notifications
        </p>
      </div>
    </div>
  );
}

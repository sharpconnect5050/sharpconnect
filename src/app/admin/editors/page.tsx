"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EDITORS, getEditorActiveCount, getEditorById, buildTelegramWebLink } from "@/lib/editors";
import { getCampaigns, formatCurrency, type Campaign } from "@/lib/adminData";
import { useRouter } from "next/navigation";

export default function EditorsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedEditor, setSelectedEditor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getCampaigns().then((d) => { if (mounted) setCampaigns(d); }).catch(console.error).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const router = useRouter();

  const editorAssignments = (editorId: string) => {
    const editor = getEditorById(editorId);
    if (!editor) return [];
    return campaigns.filter((c) => c.editor === editor.name);
  };

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
        <h1 className="text-xl sm:text-2xl font-bold">Editors</h1>
        <p className="text-xs sm:text-sm text-zinc-500 mt-1">
          {EDITORS.length} editors · {campaigns.filter((c) => c.editor && c.editor !== "Unassigned").length} active assignments
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {EDITORS.map((editor, i) => {
          const assigned = editorAssignments(editor.id);
          const activeCount = assigned.length;
          return (
            <motion.div
              key={editor.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 hover:border-white/20 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${editor.color} flex items-center justify-center text-sm font-bold text-white shadow-lg`}>
                    {editor.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{editor.name}</p>
                    <p className="text-[10px] text-zinc-500">{editor.role}</p>
                  </div>
                </div>
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium ${
                  activeCount > 2 ? "bg-red-500/10 text-red-400" :
                  activeCount > 0 ? "bg-green-500/10 text-green-400" :
                  "bg-zinc-500/10 text-zinc-400"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    activeCount > 2 ? "bg-red-500" :
                    activeCount > 0 ? "bg-green-500" :
                    "bg-zinc-500"
                  }`} />
                  {activeCount > 2 ? "Busy" : activeCount > 0 ? "Available" : "Idle"}
                </div>
              </div>

              <div className="flex items-center gap-4 mb-4 text-xs">
                <div>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Active</p>
                  <p className="text-white font-semibold mt-0.5">{activeCount} campaigns</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Rate</p>
                  <p className="text-white font-semibold mt-0.5">{editor.ratePerCampaign}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <a href={buildTelegramWebLink(editor.telegram)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[11px] text-[#0088cc] hover:text-[#33a0e0] transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                  {editor.telegram}
                </a>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {editor.specialty.map((s) => (
                  <span key={s} className="px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 text-[10px]">{s}</span>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedEditor(editor.id === selectedEditor ? null : editor.id)}
                  className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-medium transition-all"
                >
                  {selectedEditor === editor.id ? "Hide Assignments" : `${activeCount} Campaigns`}
                </button>
                <a
                  href={buildTelegramWebLink(editor.telegram)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-3 rounded-lg bg-[#0088cc]/10 hover:bg-[#0088cc]/20 text-[#0088cc] transition-all"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                </a>
              </div>

              <AnimatePresence>
                {selectedEditor === editor.id && assigned.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-4 pt-4 border-t border-white/10 overflow-hidden"
                  >
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Assigned Campaigns</p>
                    <div className="space-y-1.5">
                      {assigned.map((c) => (
                        <button
                          key={c.campaignId}
                          onClick={() => router.push("/admin/campaigns")}
                          className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.03] transition-colors text-left"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-zinc-300 truncate">{c.artistName} — {c.songTitle}</p>
                            <code className="text-[10px] font-mono text-red-400">{c.campaignId}</code>
                          </div>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            c.status === "Completed" ? "bg-emerald-500/10 text-emerald-400" :
                            c.status === "Editing" ? "bg-blue-500/10 text-blue-400" :
                            "bg-orange-500/10 text-orange-400"
                          }`}>{c.status}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
                {selectedEditor === editor.id && assigned.length === 0 && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-4 pt-4 border-t border-white/10 text-xs text-zinc-600 text-center"
                  >
                    No campaigns assigned yet
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

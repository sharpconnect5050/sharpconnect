"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { EDITORS, getTaskById, getEditorById } from "@/lib/editors";

export default function EditorDashboardRedirect() {
  const router = useRouter();
  const [taskInput, setTaskInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const task = getTaskById(taskInput.trim());
    if (task) {
      router.push(`/editor-task/${task.taskId}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-sm w-full"
      >
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center font-bold text-lg mb-4">
            S
          </div>
          <h1 className="text-xl font-bold mb-2">Editor Workspace</h1>
          <p className="text-sm text-zinc-400 mb-6">
            Editors now access individual task links. Enter your task ID below or use the link provided by your admin.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              placeholder="Paste task ID here..."
              className="w-full bg-transparent border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-red-500/50"
            />
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold text-sm transition-all"
            >
              Open Task
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Editor Teams</h3>
          <div className="space-y-2">
            {EDITORS.map((e) => (
              <div key={e.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors">
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${e.color} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}>
                  {e.initials}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-xs font-medium text-white">{e.name}</p>
                  <p className="text-[10px] text-zinc-500">{e.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <a href="/" className="block text-center mt-6 text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
          Back to SharpConnect
        </a>
      </motion.div>
    </div>
  );
}

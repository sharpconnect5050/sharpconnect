"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { addArtistNotification, getArtistNotifications, markArtistNotificationsRead, type ArtistNotification } from "@/lib/artistNotifications";

export { addArtistNotification, getArtistNotifications };

export default function ArtistNotificationToast({ campaignId }: { campaignId: string }) {
  const [notifications, setNotifications] = useState<ArtistNotification[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;
    let pending: number | undefined;
    const update = async () => {
      if (isSupabaseConfigured) {
        const { data } = await supabase
          .from("artist_notifications")
          .select("*")
          .eq("campaign_id", campaignId)
          .eq("read_status", false)
          .order("created_at", { ascending: false })
          .limit(3);
        if (!mounted) return;
        if (data) {
          setNotifications(data.map((row) => ({
            id: row.id,
            campaignId: row.campaign_id,
            type: row.type as ArtistNotification["type"],
            title: row.title,
            message: row.message,
            timestamp: row.created_at,
            read: row.read_status,
          })));
        }
      } else {
        const all = getArtistNotifications(campaignId).filter((n) => !n.read);
        if (mounted) setNotifications(all.slice(0, 3));
      }
    };
    update();
    const interval = setInterval(update, 5000);
    return () => { clearInterval(interval); clearTimeout(pending); mounted = false; };
  }, [campaignId]);

  const dismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
    setTimeout(() => { markArtistNotificationsRead(campaignId).catch(e => console.error("[dismiss] markArtistNotificationsRead failed:", e)); }, 300);
  };

  const visible = notifications.filter((n) => !dismissed.has(n.id));

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {visible.map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            className="pointer-events-auto rounded-xl border border-white/10 bg-black/95 backdrop-blur-xl p-4 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <span className="text-lg mt-0.5">
                {n.type === "payment_approved" ? "✅" : n.type === "campaign_started" ? "🚀" : n.type === "campaign_completed" ? "🎉" : "📌"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{n.title}</p>
                <p className="text-xs text-zinc-400 mt-0.5">{n.message}</p>
              </div>
              <button onClick={() => dismiss(n.id)} className="text-zinc-600 hover:text-white shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

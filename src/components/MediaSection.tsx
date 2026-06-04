"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { getCampaignUploads, type UploadRecord } from "@/lib/storage";
import AudioPlayer from "./AudioPlayer";
import ImageViewer from "./ImageViewer";
import VideoPlayer from "./VideoPlayer";

interface MediaSectionProps {
  campaignId: string;
  audioUrl?: string;
  videoUrl?: string;
  tiktokSoundLink?: string;
}

export default function MediaSection({ campaignId, audioUrl, videoUrl, tiktokSoundLink }: MediaSectionProps) {
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getCampaignUploads(campaignId)
      .then((d) => { if (mounted) setUploads(d); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [campaignId]);

  const copyLink = useCallback(async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, []);

  const downloadFile = useCallback((url: string, name: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const audioFiles = useMemo(() => uploads.filter((u) => u.file_type === "audio"), [uploads]);
  const videos = useMemo(() => uploads.filter((u) => u.file_type === "reference_video"), [uploads]);
  const paymentProofs = useMemo(
    () => uploads.filter((u) => u.file_type === "payment_proof" || u.file_type === "payment_receipt"),
    [uploads]
  );

  const hasUploadMedia = useMemo(() => audioFiles.length > 0 || videos.length > 0 || paymentProofs.length > 0, [audioFiles, videos, paymentProofs]);
  const hasCampaignMedia = useMemo(() => !!(audioUrl || videoUrl || tiktokSoundLink), [audioUrl, videoUrl, tiktokSoundLink]);

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!hasUploadMedia && !hasCampaignMedia) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
        <p className="text-xs text-zinc-500 text-center py-4">No media files uploaded for this campaign</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-4"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-[10px] font-bold text-white">
          M
        </div>
        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Media Files
        </h4>
        <span className="text-[10px] text-zinc-600 ml-auto">
          {uploads.length} file{uploads.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-4">
        {(audioFiles.length > 0 || audioUrl) && (
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Audio
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {audioFiles.map((u) => (
                <AudioPlayer
                  key={u.id}
                  src={u.file_url}
                  fileName={u.file_name}
                  onDownload={() => downloadFile(u.file_url, u.file_name)}
                  onCopyLink={() => copyLink(u.file_url, u.id)}
                />
              ))}
              {audioFiles.length === 0 && audioUrl && (
                <AudioPlayer src={audioUrl} fileName="audio"
                  onDownload={() => downloadFile(audioUrl, "audio")}
                  onCopyLink={() => copyLink(audioUrl, "campaign-audio")} />
              )}
            </div>
          </div>
        )}

        {(videos.length > 0 || videoUrl) && (
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              Reference Video
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {videos.map((u) => (
                <VideoPlayer
                  key={u.id}
                  src={u.file_url}
                  fileName={u.file_name}
                  onDownload={() => downloadFile(u.file_url, u.file_name)}
                  onCopyLink={() => copyLink(u.file_url, u.id)}
                />
              ))}
              {videos.length === 0 && videoUrl && (
                <VideoPlayer src={videoUrl} fileName="reference-video"
                  onDownload={() => downloadFile(videoUrl, "reference-video")}
                  onCopyLink={() => copyLink(videoUrl, "campaign-video")} />
              )}
            </div>
          </div>
        )}

        {tiktokSoundLink && (
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
              TikTok Sound Link
            </p>
            <a href={tiktokSoundLink} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-400 hover:text-sky-300 truncate"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              {tiktokSoundLink}
            </a>
          </div>
        )}
        {paymentProofs.length > 0 && (
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Payment Proof
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {paymentProofs.map((u) => (
                <ImageViewer
                  key={u.id}
                  src={u.file_url}
                  alt="Payment proof"
                  fileName={u.file_name}
                  onDownload={() => downloadFile(u.file_url, u.file_name)}
                  onCopyLink={() => copyLink(u.file_url, u.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

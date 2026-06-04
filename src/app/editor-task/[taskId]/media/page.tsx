"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { getCampaign, type Campaign } from "@/lib/adminData";
import { getEditorById, getTaskById } from "@/lib/editors";
import { getCampaignUploads, type UploadRecord } from "@/lib/storage";
import AudioPlayer from "@/components/AudioPlayer";
import VideoPlayer from "@/components/VideoPlayer";

export default function EditorMediaPage() {
  const params = useParams();
  const taskId = params?.taskId as string;

  const [task, setTask] = useState<ReturnType<typeof getTaskById>>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!taskId) return;
    let mounted = true;
    const t = getTaskById(taskId);
    if (!t) { setInvalid(true); setLoading(false); return; }
    setTask(t);

    const editor = getEditorById(t.editorId);
    if (!editor) { setInvalid(true); setLoading(false); return; }

    getCampaign(t.campaignId).then((c) => {
      if (!mounted) return;
      if (!c) { setInvalid(true); setLoading(false); return; }
      setCampaign(c);
      setLoading(false);
    }).catch((e) => { console.error("[EditorMediaPage] getCampaign failed:", e); if (mounted) setLoading(false); });

    getCampaignUploads(t.campaignId).then((d) => { if (mounted) setUploads(d); }).catch(console.error);
    return () => { mounted = false; };
  }, [taskId]);

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

  const downloadAllMedia = () => {
    editorUploads.forEach((u) => downloadFile(u.file_url, u.file_name));
    if (campaign?.audioUrl) downloadFile(campaign.audioUrl, "audio");
    if (campaign?.videoUrl) downloadFile(campaign.videoUrl, "reference-video");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="max-w-sm w-full rounded-2xl border border-red-500/20 bg-red-500/5 backdrop-blur-xl p-8 text-center"
        >
          <span className="text-4xl block mb-4">🔒</span>
          <h1 className="text-lg font-bold text-white mb-2">Invalid or Expired Task</h1>
          <p className="text-sm text-zinc-400">This media link is not valid or has expired. Please contact the SharpConnect admin for a new link.</p>
          <a href="/" className="mt-6 inline-flex px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold">Back to Home</a>
        </motion.div>
      </div>
    );
  }

  if (!campaign || !task) return null;

  const editor = getEditorById(task.editorId);
  const editorUploads = uploads.filter((u) => u.file_type === "audio" || u.file_type === "reference_video");
  const audioFiles = editorUploads.filter((u) => u.file_type === "audio");
  const videos = editorUploads.filter((u) => u.file_type === "reference_video");
  const hasUploads = editorUploads.length > 0;
  const hasCampaignMedia = campaign.audioUrl || campaign.videoUrl || campaign.tiktokSoundLink;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-lg mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center font-bold text-xs">S</div>
            <span className="font-semibold text-sm">Reference Media</span>
          </div>
          {editor && (
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${editor.color} flex items-center justify-center text-[8px] font-bold text-white`}>
                {editor.initials}
              </div>
              <span className="hidden sm:inline">{editor.name}</span>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4 pb-24">
        {/* Campaign Info */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-4"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold">{campaign.artistName}</h1>
              <p className="text-xs text-zinc-400">{campaign.songTitle}</p>
            </div>
            <code className="text-[10px] font-mono text-red-400 bg-red-500/10 px-2 py-0.5 rounded shrink-0 ml-2">{campaign.campaignId}</code>
          </div>
          <div className="pt-3 border-t border-white/10">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Creative Direction</p>
            <p className="text-xs text-zinc-300">{campaign.creativeDirection}</p>
          </div>
        </motion.div>

        {/* Media Files */}
        {(hasUploads || hasCampaignMedia) ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-4"
          >
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Reference Media</h3>
            <div className="space-y-4">
              {(audioFiles.length > 0 || campaign.audioUrl) && (
                <div>
                  <p className="text-[10px] text-zinc-500 mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Audio
                  </p>
                  <div className="space-y-2">
                    {audioFiles.map((u) => (
                      <AudioPlayer key={u.id} src={u.file_url} fileName={u.file_name}
                        onDownload={() => downloadFile(u.file_url, u.file_name)} />
                    ))}
                    {audioFiles.length === 0 && campaign.audioUrl && (
                      <AudioPlayer src={campaign.audioUrl} fileName="audio"
                        onDownload={() => downloadFile(campaign.audioUrl, "audio")} />
                    )}
                  </div>
                </div>
              )}
              {(videos.length > 0 || campaign.videoUrl) && (
                <div>
                  <p className="text-[10px] text-zinc-500 mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> Reference Video
                  </p>
                  <div className="space-y-2">
                    {videos.map((u) => (
                      <VideoPlayer key={u.id} src={u.file_url} fileName={u.file_name}
                        onDownload={() => downloadFile(u.file_url, u.file_name)} />
                    ))}
                    {videos.length === 0 && campaign.videoUrl && (
                      <VideoPlayer src={campaign.videoUrl} fileName="reference-video"
                        onDownload={() => downloadFile(campaign.videoUrl, "reference-video")} />
                    )}
                  </div>
                </div>
              )}
              {campaign.tiktokSoundLink && (
                <div>
                  <p className="text-[10px] text-zinc-500 mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500" /> TikTok Sound Link
                  </p>
                  <a href={campaign.tiktokSoundLink} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-400 hover:text-sky-300 truncate"
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    {campaign.tiktokSoundLink}
                  </a>
                </div>
              )}
            </div>

            <button onClick={downloadAllMedia}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-medium text-zinc-300 hover:text-white hover:border-white/20 transition-all active:scale-[0.98] touch-target"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download All Media
            </button>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 text-center"
          >
            <p className="text-sm text-zinc-500">No reference media available for this campaign.</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

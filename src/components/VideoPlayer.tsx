"use client";

import React, { useRef, useState } from "react";
import { motion } from "framer-motion";

interface VideoPlayerProps {
  src: string;
  fileName: string;
  onDownload?: () => void;
  onCopyLink?: () => void;
}

function VideoPlayer({ src, fileName, onDownload, onCopyLink }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const toggle = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleEnded = () => setPlaying(false);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-white truncate">{fileName}</p>
          <p className="text-[10px] text-zinc-500">Reference template</p>
        </div>
      </div>

      <div className="relative rounded-lg overflow-hidden bg-black/60 aspect-video flex items-center justify-center group cursor-pointer">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <video
          ref={videoRef}
          src={src}
          onLoadedData={() => setLoaded(true)}
          onEnded={handleEnded}
          className={`w-full h-full object-contain ${loaded ? "opacity-100" : "opacity-0"}`}
          playsInline
          onClick={toggle}
        />
        {!playing && loaded && (
          <div
            onClick={toggle}
            className="absolute inset-0 bg-black/30 flex items-center justify-center transition-opacity group-hover:bg-black/40"
          >
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="w-16 h-16 rounded-full bg-red-600/90 flex items-center justify-center shadow-lg shadow-red-500/30"
            >
              <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </motion.div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
        {onDownload && (
          <button
            onClick={onDownload}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-[10px] transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </button>
        )}
        {onCopyLink && (
          <button
            onClick={onCopyLink}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-[10px] transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Copy Link
          </button>
        )}
      </div>
    </div>
  );
}

export default React.memo(VideoPlayer);

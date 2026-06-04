"use client";

import { useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { validateFile } from "@/lib/storage";

interface FileUploadProps {
  label: string;
  hint: string;
  accept: string;
  bucket: string;
  file: File | null;
  setFile: (f: File | null) => void;
  error?: string;
  progress?: number;
  uploading?: boolean;
}

const SIZE_WARNINGS: Record<string, string> = {
  "campaign-audio": "Max 20MB. Large files will be compressed.",

  "campaign-reference-videos": "Max 50MB. Uploaded via Telegram for reliable hosting.",
  "campaign-payment-proof": "Max 5MB.",
  "campaign-editor-submissions": "Max 100MB for videos.",
  "campaign-final-approved": "Max 100MB.",
};

export default function FileUpload({
  label,
  hint,
  accept,
  bucket,
  file,
  setFile,
  error,
  progress,
  uploading,
}: FileUploadProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState("");

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (!f) return;
      const err = validateFile(f, bucket);
      if (err) { setLocalError(err); return; }
      setLocalError("");
      setFile(f);
    },
    [bucket, setFile]
  );

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const err = validateFile(f, bucket);
      if (err) { setLocalError(err); return; }
      setLocalError("");
      setFile(f);
    },
    [bucket, setFile]
  );

  const displayError = error || localError;
  const sizeWarning = SIZE_WARNINGS[bucket];

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && ref.current?.click()}
      className={`relative cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-all duration-300 ${
        dragOver
          ? "border-red-500/60 bg-red-500/10"
          : file
          ? "border-red-500/30 bg-red-500/5"
          : "border-white/10 bg-white/[0.02] hover:border-red-500/30"
      } ${uploading ? "pointer-events-none opacity-70" : ""}`}
    >
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleInput}
        disabled={uploading}
      />

      {uploading ? (
        <div className="space-y-3 py-2">
          <div className="w-10 h-10 mx-auto rounded-xl bg-red-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-red-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <p className="text-xs text-zinc-400">Uploading{progress !== undefined && progress > 0 ? ` ${progress}%` : "..."}</p>
          {progress !== undefined && progress > 0 && (
            <div className="w-full max-w-xs mx-auto h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          )}
        </div>
      ) : file ? (
        <div className="space-y-2">
          <div className="w-10 h-10 mx-auto rounded-xl bg-green-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-xs text-zinc-300 truncate px-1">{file.name}</p>
          <p className="text-[10px] text-zinc-500">
            {(file.size / 1024 / 1024).toFixed(1)} MB
          </p>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setFile(null); setLocalError(""); }}
            className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="w-12 h-12 mx-auto rounded-xl bg-white/5 flex items-center justify-center">
            <svg className="w-6 h-6 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-sm text-zinc-300 font-medium">{label}</p>
          <p className="text-[10px] text-zinc-500">{hint}</p>
        </div>
      )}

      {!uploading && !file && sizeWarning && (
        <p className="mt-2 text-[9px] text-zinc-600">{sizeWarning}</p>
      )}

      {displayError && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-xs text-red-400"
        >
          {displayError}
        </motion.p>
      )}
    </div>
  );
}

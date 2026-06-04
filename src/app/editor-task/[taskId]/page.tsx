"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getCampaign, updateCampaign, type Campaign } from "@/lib/adminData";
import { getEditorById, getTaskById, saveEditorSubmission, getEditorSubmission, type EditorSubmission } from "@/lib/editors";
import { uploadFile, BUCKETS, validateFile } from "@/lib/storage";
import { addAlert } from "@/components/AdminNotifications";
import { logEvent } from "@/lib/events";

export default function EditorTaskPage() {
  const params = useParams();
  const taskId = params?.taskId as string;

  const [task, setTask] = useState<ReturnType<typeof getTaskById>>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [submission, setSubmission] = useState<EditorSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);

  // Submission form state
  const [editFile, setEditFile] = useState<File | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [exportFile, setExportFile] = useState<File | null>(null);
  const [submitNotes, setSubmitNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

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
    }).catch((e) => { console.error("[EditorTaskPage] getCampaign failed:", e); if (mounted) setLoading(false); });

    const existing = getEditorSubmission(taskId);
    if (existing) {
      setSubmission(existing);
      if (existing.status === "approved") setSubmitSuccess(true);
    }
    return () => { mounted = false; };
  }, [taskId]);

  const handleSubmit = async () => {
    if (!task || !campaign) return;
    if (!editFile && !templateFile && !exportFile) {
      setSubmitError("Please upload at least one file (edited video, template, or export).");
      return;
    }
    setSubmitting(true);
    setSubmitError("");

    try {
      const files: EditorSubmission["files"] = [];

      if (editFile) {
        const err = validateFile(editFile, BUCKETS.EDITOR_SUBMISSION);
        if (err) { setSubmitError(`Edited Video: ${err}`); setSubmitting(false); return; }
        const result = await uploadFile(editFile, BUCKETS.EDITOR_SUBMISSION, campaign.campaignId, "edited_video");
        if (result.error) { setSubmitError(`Edited Video upload failed: ${result.error}`); setSubmitting(false); return; }
        files.push({ id: Date.now().toString(36), fileType: "edited_video", fileName: editFile.name, fileUrl: result.url, mimeType: editFile.type, uploadedAt: new Date().toISOString() });
      }
      if (templateFile) {
        const err = validateFile(templateFile, BUCKETS.EDITOR_SUBMISSION);
        if (err) { setSubmitError(`Template: ${err}`); setSubmitting(false); return; }
        const result = await uploadFile(templateFile, BUCKETS.EDITOR_SUBMISSION, campaign.campaignId, "completed_template");
        if (result.error) { setSubmitError(`Template upload failed: ${result.error}`); setSubmitting(false); return; }
        files.push({ id: Date.now().toString(36), fileType: "completed_template", fileName: templateFile.name, fileUrl: result.url, mimeType: templateFile.type, uploadedAt: new Date().toISOString() });
      }
      if (exportFile) {
        const err = validateFile(exportFile, BUCKETS.EDITOR_SUBMISSION);
        if (err) { setSubmitError(`Export: ${err}`); setSubmitting(false); return; }
        const result = await uploadFile(exportFile, BUCKETS.EDITOR_SUBMISSION, campaign.campaignId, "export_file");
        if (result.error) { setSubmitError(`Export upload failed: ${result.error}`); setSubmitting(false); return; }
        files.push({ id: Date.now().toString(36), fileType: "export_file", fileName: exportFile.name, fileUrl: result.url, mimeType: exportFile.type, uploadedAt: new Date().toISOString() });
      }

      const sub: EditorSubmission = {
        taskId: task.taskId,
        campaignId: campaign.campaignId,
        editorId: task.editorId,
        files,
        notes: submitNotes,
        submittedAt: new Date().toISOString(),
        status: "pending",
      };

      const saved = saveEditorSubmission(sub);
      if (!saved) {
        setSubmitError("Submission data too large to store locally. Configure Supabase or use smaller files.");
        setSubmitting(false);
        return;
      }

      await updateCampaign(campaign.campaignId, { status: "Pending Artist Review" });
      const editorName = getEditorById(task.editorId)?.name || task.editorId;
      addAlert("editor_submitted", `${editorName} submitted ${campaign.campaignId} for review.`, campaign.campaignId);
      await logEvent(campaign.campaignId, "editor_submitted", { editorId: task.editorId, taskId: task.taskId });

      setSubmission(sub);
      setSubmitSuccess(true);
      setEditFile(null);
      setTemplateFile(null);
      setExportFile(null);
      setSubmitNotes("");
    } catch (err: any) {
      setSubmitError(err.message || "Submission failed");
    }
    setSubmitting(false);
  };

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Invalid/not found
  if (invalid) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="max-w-sm w-full rounded-2xl border border-red-500/20 bg-red-500/5 backdrop-blur-xl p-8 text-center"
        >
          <span className="text-4xl block mb-4">🔒</span>
          <h1 className="text-lg font-bold text-white mb-2">Invalid or Expired Task</h1>
          <p className="text-sm text-zinc-400">This editor task link is not valid or has expired. Please contact the SharpConnect admin for a new link.</p>
          <a href="/" className="mt-6 inline-flex px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold">Back to Home</a>
        </motion.div>
      </div>
    );
  }

  if (!campaign || !task) return null;

  const editor = getEditorById(task.editorId);
  const canSubmit = !submission || submission.status === "needs_revision";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Editor Header */}
      <header className="sticky top-0 z-30 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-lg mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center font-bold text-xs">S</div>
            <span className="font-semibold text-sm">Editor Task</span>
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

          {/* Status badge */}
          <div className="flex items-center gap-2 mb-3">
            {!submission ? (
              <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-medium border border-blue-500/20">
                Awaiting Submission
              </span>
            ) : submission.status === "pending" ? (
              <span className="px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-400 text-[10px] font-medium border border-yellow-500/20">
                Pending Admin Review
              </span>
            ) : submission.status === "needs_revision" ? (
              <span className="px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-400 text-[10px] font-medium border border-orange-500/20">
                Needs Revision
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 text-[10px] font-medium border border-green-500/20">
                Approved ✓
              </span>
            )}
            {editor && (
              <div className={`px-2 py-0.5 rounded-full bg-gradient-to-r ${editor.color} text-white text-[9px] font-medium`}>
                {editor.name}
              </div>
            )}
          </div>

          {/* Creative Direction */}
          <div className="pt-3 border-t border-white/10">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Creative Direction</p>
            <p className="text-xs text-zinc-300">{campaign.creativeDirection}</p>
          </div>
        </motion.div>

        {/* Already submitted - show status */}
        {submission && submission.status === "approved" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-green-500/20 bg-green-500/5 backdrop-blur-xl p-6 text-center"
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-green-400 mb-1">Approved!</h3>
            <p className="text-xs text-zinc-400">Your submission has been approved by the admin.</p>
          </motion.div>
        )}

        {submission && submission.status === "needs_revision" && submission.adminNotes && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-orange-500/20 bg-orange-500/5 backdrop-blur-xl p-4"
          >
            <h4 className="text-xs font-semibold text-orange-400 flex items-center gap-2 mb-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Revision Requested
            </h4>
            <p className="text-sm text-zinc-300">{submission.adminNotes}</p>
          </motion.div>
        )}

        {/* Already submitted pending - no new upload */}
        {submission && submission.status === "pending" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 backdrop-blur-xl p-6 text-center"
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-yellow-500/20 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-yellow-400 mb-1">Under Admin Review</h3>
            <p className="text-xs text-zinc-400">Your submission is being reviewed by the admin. You will be notified if revisions are needed.</p>
          </motion.div>
        )}

        {/* Submit Section (only if not yet submitted or needs revision) */}
        {canSubmit && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-4"
          >
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">
              {submission?.status === "needs_revision" ? "Re-upload Your Edit" : "Upload Finished Edit"}
            </h3>

            <div className="space-y-4">
              {/* Edited Video */}
              <div>
                <p className="text-[10px] text-zinc-500 mb-1.5">Finished Edit Video</p>
                <FileDrop label="Upload edited video" accept="video/mp4,video/quicktime" file={editFile} setFile={setEditFile} />
              </div>

              {/* Completed Template */}
              <div>
                <p className="text-[10px] text-zinc-500 mb-1.5">Completed Template</p>
                <FileDrop label="Upload completed template" accept="image/jpeg,image/png,video/mp4" file={templateFile} setFile={setTemplateFile} />
              </div>

              {/* Export Files */}
              <div>
                <p className="text-[10px] text-zinc-500 mb-1.5">Export Files (ZIP or other)</p>
                <FileDrop label="Upload export files" accept=".zip,.rar,.7z,application/zip,application/x-zip-compressed" file={exportFile} setFile={setExportFile} />
              </div>

              {/* Notes */}
              <div>
                <p className="text-[10px] text-zinc-500 mb-1.5">Notes for Admin</p>
                <textarea value={submitNotes} onChange={(e) => setSubmitNotes(e.target.value)}
                  placeholder="Optional notes about your edit..."
                  rows={3}
                  className="w-full bg-transparent border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-red-500/50 resize-none"
                />
              </div>

              {submitError && (
                <div className="space-y-2">
                  <p className="text-xs text-red-400">{submitError}</p>
                  <button onClick={handleSubmit} disabled={submitting}
                    className="w-full py-2 rounded-lg border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/10 transition-all active:scale-[0.98]"
                  >
                    Retry Upload
                  </button>
                </div>
              )}

              <button onClick={handleSubmit} disabled={submitting || !!submitError}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold text-sm transition-all disabled:opacity-50 active:scale-[0.98] touch-target"
              >
                {submitting ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin block mx-auto" />
                ) : submission?.status === "needs_revision" ? (
                  "Re-submit for Review"
                ) : (
                  "Submit for Review"
                )}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ─── INLINE FILE DROP (no external dep) ──────────────────────

function FileDrop({ label, accept, file, setFile }: {
  label: string;
  accept: string;
  file: File | null;
  setFile: (f: File | null) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
      onClick={() => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = accept;
        input.onchange = () => { if (input.files?.[0]) setFile(input.files[0]); };
        input.click();
      }}
      className={`cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition-all ${
        dragOver ? "border-red-500/60 bg-red-500/10" : file ? "border-red-500/30 bg-red-500/5" : "border-white/10 bg-white/[0.02] hover:border-red-500/30"
      }`}
    >
      {file ? (
        <div className="space-y-1">
          <div className="w-8 h-8 mx-auto rounded-lg bg-green-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-xs text-zinc-300 truncate px-1">{file.name}</p>
          <p className="text-[10px] text-zinc-500">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
          <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }}
            className="text-[10px] text-red-400 hover:text-red-300">Remove</button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="w-8 h-8 mx-auto rounded-lg bg-white/5 flex items-center justify-center">
            <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-xs text-zinc-400">{label}</p>
        </div>
      )}
    </div>
  );
}

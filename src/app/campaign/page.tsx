"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import FileUpload from "@/components/FileUpload";
import { BUCKETS, uploadCampaignFiles } from "@/lib/storage";

type Package = "standard" | "premium" | "repost" | null;
type SoundOption = "original" | "slow-reverb" | "fast";

const packages = [
  {
    id: "standard" as const,
    name: "Standard Promo",
    price: 1000,
    features: ["1 CapCut template", "Promotion across 4 TikTok pages"],
  },
  {
    id: "premium" as const,
    name: "Promo + Edited Sound",
    price: 1300,
    features: [
      "Everything in Standard Promo",
      "Slow/Fast sound editing",
    ],
  },
  {
    id: "repost" as const,
    name: "Additional Repost Boost",
    price: 1000,
    features: ["Additional repost campaign cycle"],
  },
];

const styleTags = [
  "Emotional",
  "Cinematic",
  "Dark Edit",
  "Dance Trend",
  "Funny Meme Style",
  "Luxury Vibes",
  "Anime Style",
];

const sections = [
  "Artist Info",
  "Package",
  "Uploads",
  "Creative Direction",
  "Style Tags",
  "Sound Options",
];

export default function CampaignPage() {
  const [artistName, setArtistName] = useState("");
  const [songTitle, setSongTitle] = useState("");
  const [tiktokHandle, setTiktokHandle] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<Package>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [referenceVideo, setReferenceVideo] = useState<File | null>(null);
  const [tiktokSoundLink, setTiktokSoundLink] = useState("");
  const [creativeDirection, setCreativeDirection] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [soundOption, setSoundOption] = useState<SoundOption>("original");
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadError, setUploadError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const pkg = selectedPackage ? packages.find((p) => p.id === selectedPackage) : null;
  const packagePrice = pkg?.price ?? 0;
  const soundFee = soundOption === "original" ? 0 : 300;
  const total = packagePrice + soundFee;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!artistName.trim()) errs.artistName = "Required";
    else if (artistName.length > 100) errs.artistName = "Max 100 characters";
    if (!songTitle.trim()) errs.songTitle = "Required";
    else if (songTitle.length > 200) errs.songTitle = "Max 200 characters";
    if (!tiktokHandle.trim()) errs.tiktokHandle = "Required";
    else {
      let raw = tiktokHandle.trim();
      if (raw.startsWith("@")) raw = raw.slice(1);
      const urlMatch = raw.match(/tiktok\.com\/@?([\w.]+)/i);
      if (urlMatch) raw = urlMatch[1];
      raw = raw.replace(/[^a-zA-Z0-9_.]/g, "");
      if (raw.length < 2 || raw.length > 30)
        errs.tiktokHandle = "Enter a valid TikTok handle (2-30 characters)";
    }
    if (!whatsapp.trim()) errs.whatsapp = "Required";
    else if (!/^\+?[0-9]{7,15}$/.test(whatsapp.trim().replace(/[\s\-]/g, "")))
      errs.whatsapp = "Enter a valid phone number (e.g. +233 XX XXX XXXX)";
    if (email.trim() && !/\S+@\S+\.\S+/.test(email))
      errs.email = "Invalid email format";
    if (!selectedPackage) errs.package = "Select a package";
    if (!audioFile && !tiktokSoundLink.trim()) errs.audio = "Upload audio or provide a TikTok sound link";
    else if (tiktokSoundLink.trim() && !/^https?:\/\/(www\.)?(vm\.)?tiktok\.com\/.+/.test(tiktokSoundLink.trim()))
      errs.audio = "Invalid TikTok URL";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  function generateId() {
    return "SC-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setUploadError("");

    try {
      const campaignId = generateId();
      const pkg = packages.find((p) => p.id === selectedPackage);
      if (!pkg) { setSubmitting(false); setUploadError("Invalid package selection. Please try again."); return; }

      let audioUrl = "";
      let videoUrl = "";

      if (audioFile || referenceVideo) {
        const result = await uploadCampaignFiles(
          campaignId,
          { audio: audioFile, referenceVideo },
          (type, percent) => {
            setUploadProgress((prev) => ({ ...prev, [type]: percent }));
          }
        );
        audioUrl = result.audioUrl || "";
        videoUrl = result.videoUrl || "";
        if (result.errors.length > 0) {
          setUploadError(result.errors.join("; "));
        }
      }

      const campaignData = {
        artistName,
        songTitle,
        tiktokHandle,
        instagramHandle,
        whatsapp,
        email,
        packageId: selectedPackage,
        packageName: pkg.name,
        packagePrice: pkg.price,
        soundOption,
        soundFee,
        total,
        creativeDirection,
        selectedTags,
        hasAudio: !!audioFile,
        hasVideo: !!referenceVideo,
        campaignId,
        audioUrl,
        videoUrl,
        tiktokSoundLink,
      };

      sessionStorage.setItem(
        "sharpconnect_campaign",
        JSON.stringify(campaignData)
      );
      window.location.href = "/payment";
    } catch (e) {
      console.error("[CampaignPage] submit failed:", e);
      setSubmitting(false);
      setUploadError("Something went wrong. Please try again.");
    }
  };

  const currentSection = (() => {
    if (!artistName && !songTitle && !tiktokHandle) return 0;
    if (!selectedPackage) return 1;
    if (!audioFile) return 2;
    if (!creativeDirection) return 3;
    if (selectedTags.length === 0) return 4;
    return 5;
  })();

  const progressPercent = ((currentSection + 1) / sections.length) * 100;

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-white/[0.06] bg-black/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center font-bold text-xs">
              S
            </div>
            <span className="font-semibold text-sm hidden sm:block tracking-tight">
              SharpConnect
            </span>
          </a>
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span>Campaign</span>
            <span className="w-1 h-1 rounded-full bg-zinc-700" />
            <a href="/" className="hover:text-white transition-colors">
              Back to Home
            </a>
          </div>
        </div>
      </header>

      <div className="sticky top-16 z-40 bg-black/80 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
            <span>Progress</span>
            <span>
              {currentSection + 1} / {sections.length}
            </span>
          </div>
          <div className="w-full h-[3px] bg-white/[0.04] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          <div className="hidden sm:flex items-center gap-1 mt-2">
            {sections.map((s, i) => (
              <div
                key={s}
                className={`flex items-center gap-1 text-[10px] ${
                  i <= currentSection ? "text-red-400" : "text-zinc-600"
                }`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    i <= currentSection ? "bg-red-500" : "bg-zinc-700"
                  }`}
                />
                <span className="hidden md:inline">{s}</span>
                {i < sections.length - 1 && (
                  <span className="text-zinc-800 mx-0.5">-</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="lg:grid lg:grid-cols-3 lg:gap-10">
          <div className="lg:col-span-2 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Submit Your{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600">
                  Campaign
                </span>
              </h1>
              <p className="mt-3 text-zinc-400 max-w-xl text-sm sm:text-base leading-relaxed">
                Upload your song, describe your vision, and launch your TikTok
                template promotion campaign.
              </p>
            </motion.div>

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-6 sm:p-8"
            >
              <h2 className="text-lg font-semibold mb-6 flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-red-500/15 text-red-400 flex items-center justify-center text-xs font-bold">
                  1
                </span>
                Artist Information
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: "Artist Name", value: artistName, setter: setArtistName, key: "artistName", required: true },
                  { label: "Song Title", value: songTitle, setter: setSongTitle, key: "songTitle", required: true },
                  { label: "TikTok Handle", value: tiktokHandle, setter: setTiktokHandle, key: "tiktokHandle", required: true },
                  { label: "Instagram Handle (optional)", value: instagramHandle, setter: setInstagramHandle, key: "instagramHandle", required: false },
                  { label: "WhatsApp Number", value: whatsapp, setter: setWhatsapp, key: "whatsapp", required: true },
                  { label: "Email Address (optional)", value: email, setter: setEmail, key: "email", type: "email", required: false },
                ].map((field) => (
                  <div key={field.key} className="relative">
                    <input
                      id={field.key}
                      type={field.type || "text"}
                      value={field.value}
                      onChange={(e) => field.setter(e.target.value)}
                      placeholder=" "
                      className={`peer w-full bg-transparent border rounded-xl px-4 pt-6 pb-2 text-sm text-white outline-none transition-all duration-200 ${
                        errors[field.key]
                          ? "border-red-500"
                          : "border-white/[0.08] focus:border-red-500/50"
                      }`}
                    />
                    <label
                      htmlFor={field.key}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500 transition-all duration-200 peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-sm peer-focus:top-3 peer-focus:text-[10px] peer-focus:text-red-400"
                    >
                      {field.label}
                      {field.required && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </label>
                    {errors[field.key] && (
                      <p className="mt-1 text-xs text-red-400">
                        {errors[field.key]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-6 sm:p-8"
            >
              <h2 className="text-lg font-semibold mb-6 flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-red-500/15 text-red-400 flex items-center justify-center text-xs font-bold">
                  2
                </span>
                Select Your Package
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {packages.map((pkg) => {
                  const selected = selectedPackage === pkg.id;
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => setSelectedPackage(pkg.id)}
                      className={`relative text-left rounded-xl border p-5 transition-all duration-300 ${
                        selected
                          ? "border-red-500/40 bg-red-500/[0.06] shadow-lg shadow-red-500/10"
                          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                      }`}
                    >
                      {selected && (
                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-red-600 flex items-center justify-center">
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      )}
                      <h3 className="text-sm font-semibold text-white mb-1">
                        {pkg.name}
                      </h3>
                      <p className="text-xl font-bold text-red-400 mb-3">
                        GHC {pkg.price.toLocaleString()}
                      </p>
                      <ul className="space-y-1">
                        {pkg.features.map((f) => (
                          <li
                            key={f}
                            className="text-xs text-zinc-400 flex items-start gap-1.5"
                          >
                            <span className="text-red-400 mt-0.5">-</span>
                            {f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>
              {errors.package && (
                <p className="mt-2 text-xs text-red-400">{errors.package}</p>
              )}
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-6 sm:p-8"
            >
              <h2 className="text-lg font-semibold mb-6 flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-red-500/15 text-red-400 flex items-center justify-center text-xs font-bold">
                  3
                </span>
                Upload Your Files
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FileUpload
                  label="Audio File"
                  hint="MP3, WAV (optional if TikTok link provided)"
                  accept="audio/*"
                  bucket={BUCKETS.AUDIO}
                  file={audioFile}
                  setFile={setAudioFile}
                  error={errors.audio}
                  uploading={submitting && !!uploadProgress.audio}
                  progress={uploadProgress.audio}
                />
                <FileUpload
                  label="Reference Template"
                  hint="MP4, MOV (optional)"
                  accept="video/mp4,video/quicktime"
                  bucket={BUCKETS.REFERENCE_VIDEO}
                  file={referenceVideo}
                  setFile={setReferenceVideo}
                  uploading={submitting && !!uploadProgress.video}
                  progress={uploadProgress.video}
                />
              </div>
              <div className="mt-4">
                <label className="block text-xs text-zinc-500 mb-1.5">Or provide a TikTok Sound Link (optional)</label>
                <input
                  type="text"
                  value={tiktokSoundLink}
                  onChange={(e) => setTiktokSoundLink(e.target.value)}
                  placeholder="https://vm.tiktok.com/... or https://tiktok.com/..."
                  className="w-full bg-transparent border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition-all duration-200 focus:border-red-500/50"
                />
              </div>
              {errors.audio && (
                <p className="mt-2 text-xs text-red-400">{errors.audio}</p>
              )}
              {uploadError && (
                <p className="mt-2 text-xs text-yellow-400">{uploadError}</p>
              )}
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-6 sm:p-8"
            >
              <h2 className="text-lg font-semibold mb-6 flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-red-500/15 text-red-400 flex items-center justify-center text-xs font-bold">
                  4
                </span>
                Creative Direction
              </h2>

              <textarea
                value={creativeDirection}
                onChange={(e) => setCreativeDirection(e.target.value)}
                placeholder="Dark cinematic edit with emotional transitions and slow-motion effects."
                rows={4}
                className="w-full bg-transparent border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition-all duration-200 focus:border-red-500/50 resize-none"
              />
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-6 sm:p-8"
            >
              <h2 className="text-lg font-semibold mb-6 flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-red-500/15 text-red-400 flex items-center justify-center text-xs font-bold">
                  5
                </span>
                Edit Style Tags
              </h2>
              <p className="text-xs text-zinc-500 mb-4">
                Select all that apply to your vision.
              </p>

              <div className="flex flex-wrap gap-2">
                {styleTags.map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <motion.button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      whileTap={{ scale: 0.95 }}
                      className={`px-4 py-2 rounded-full text-xs font-medium transition-all duration-200 ${
                        active
                          ? "bg-red-600 text-white shadow-lg shadow-red-500/20"
                          : "bg-white/[0.04] text-zinc-400 border border-white/[0.06] hover:border-white/[0.12]"
                      }`}
                    >
                      {tag}
                    </motion.button>
                  );
                })}
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-6 sm:p-8"
            >
              <h2 className="text-lg font-semibold mb-6 flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-red-500/15 text-red-400 flex items-center justify-center text-xs font-bold">
                  6
                </span>
                Sound Options
              </h2>

              <div className="flex flex-col sm:flex-row gap-3">
                {[
                  { id: "original" as const, label: "Original Sound", price: 0 },
                  { id: "slow-reverb" as const, label: "Slow + Reverb", price: 300 },
                  { id: "fast" as const, label: "Fast Version", price: 300 },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSoundOption(opt.id)}
                    className={`flex-1 rounded-xl border p-4 text-left transition-all duration-300 ${
                      soundOption === opt.id
                        ? "border-red-500/40 bg-red-500/[0.06] shadow-lg shadow-red-500/10"
                        : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                          soundOption === opt.id
                            ? "border-red-500"
                            : "border-zinc-600"
                        }`}
                      >
                        {soundOption === opt.id && (
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {opt.label}
                        </p>
                        {opt.price > 0 && (
                          <p className="text-xs text-zinc-500">
                            +GHC {opt.price}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.section>
          </div>

          <div className="mt-8 lg:mt-0">
            <div className="lg:sticky lg:top-36">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-6 sm:p-8"
              >
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-6">
                  Price Summary
                </h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Package</span>
                    <span className="text-white font-medium">
                      {selectedPackage
                        ? `GHC ${packagePrice.toLocaleString()}`
                        : "-"}
                    </span>
                  </div>
                  {selectedPackage && (
                    <p className="text-[10px] text-zinc-500 -mt-3">
                      {
                        packages.find((p) => p.id === selectedPackage)!
                          .name
                      }
                    </p>
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Sound Edit</span>
                    <span className="text-white font-medium">
                      {soundFee > 0 ? `GHC ${soundFee}` : "GHC 0"}
                    </span>
                  </div>

                  <div className="border-t border-white/[0.06] pt-4 flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">
                      Total
                    </span>
                    <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600">
                      GHC {total.toLocaleString()}
                    </span>
                  </div>
                </div>

                <motion.button
                  type="submit"
                  disabled={submitting}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="mt-8 w-full py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold text-sm transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-red-500/20"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="w-4 h-4 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    "Continue To Payment"
                  )}
                </motion.button>

                <p className="mt-3 text-[10px] text-zinc-600 text-center">
                  You won&apos;t be charged yet
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

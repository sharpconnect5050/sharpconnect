"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const faqs = [
  {
    q: "How long does a campaign take?",
    a: "Standard campaigns go live within 48 hours of receiving your track and edit preferences. Edited sound packages typically add 24 hours for the audio production phase.",
  },
  {
    q: "What file formats do you accept?",
    a: "We accept WAV (preferred), MP3 (320kbps minimum), and FLAC formats. For best results, send us the highest quality version of your track. We also accept reference tracks for edit style guidance.",
  },
  {
    q: "Can I get a repost after my campaign ends?",
    a: "Absolutely! Our Additional Repost Boost package gives your campaign a second cycle with a fresh template variant, reaching users who may have missed it the first time.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept mobile money (MTN, Vodafone, AirtelTigo), bank transfers, and major credit/debit cards. All payments are processed securely.",
  },
  {
    q: "How many pages will my song appear on?",
    a: "All our packages include promotion across all four pages: BennyEdits, SharpConnect, CapCutAfrica, and SharpEditz. This gives your song maximum exposure across our combined audience.",
  },
  {
    q: "Can I choose the edit style of my template?",
    a: "Yes! During the onboarding process, you'll describe your preferred edit style. Our team will match the template aesthetic to your vision — whether that's energetic transitions, cinematic storytelling, or raw performance highlights.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="relative py-16 sm:py-32">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Frequently Asked{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600">
              Questions
            </span>
          </h2>
          <p className="mt-3 text-zinc-400 text-sm sm:text-base">
            Everything you need to know about promoting your music with us.
          </p>
        </motion.div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className={`w-full text-left rounded-2xl border p-5 transition-all duration-300 ${
                  openIndex === i
                    ? "border-red-500/30 bg-red-500/[0.04]"
                    : "border-white/[0.06] bg-white/[0.03] hover:border-white/[0.12]"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm sm:text-base font-medium text-white">
                    {faq.q}
                  </span>
                  <svg
                    className={`w-4 h-4 text-zinc-500 shrink-0 transition-transform duration-300 ${
                      openIndex === i ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>

                <AnimatePresence>
                  {openIndex === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <p className="mt-4 text-sm text-zinc-400 leading-relaxed border-t border-white/[0.06] pt-4">
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

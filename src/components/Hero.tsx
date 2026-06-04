"use client";

import { motion } from "framer-motion";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      <div className="absolute inset-0 bg-gradient-to-b from-red-950/15 via-black to-black" />

      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-red-600/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-red-500/4 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
        {/* Left — Text */}
        <div className="text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.06] bg-white/[0.03] text-xs sm:text-sm text-zinc-400 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Premium TikTok Promotion
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08]"
          >
            Turn Your Song Into a{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-red-500 to-red-600">
              Viral TikTok
            </span>{" "}
            Template Trend
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="mt-6 text-base sm:text-lg text-zinc-400 max-w-xl mx-auto lg:mx-0 leading-relaxed"
          >
            Promote your music with high-quality TikTok edit campaigns designed
            to increase visibility and engagement.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
            className="mt-10 flex flex-col sm:flex-row items-center lg:justify-start justify-center gap-3"
          >
            <a
              href="/campaign"
              className="relative group w-full sm:w-auto text-center px-8 py-4 sm:py-3.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-all duration-200 hover:shadow-xl hover:shadow-red-500/30"
            >
              <span className="relative z-10">Start Campaign</span>
              <div className="absolute inset-0 rounded-full bg-red-400 blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-300" />
            </a>
            <a
              href="#pricing"
              className="w-full sm:w-auto text-center px-8 py-4 sm:py-3.5 rounded-full border border-white/[0.12] text-white font-semibold text-sm hover:bg-white/[0.04] transition-all duration-200"
            >
              View Packages
            </a>
          </motion.div>
        </div>

        {/* Right — Phone Mockup */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          className="hidden lg:flex justify-center"
        >
          <div className="relative w-[300px] h-[600px]">
            {/* Phone frame */}
            <div className="absolute inset-0 rounded-[3rem] border-[3px] border-zinc-800 bg-black shadow-2xl shadow-red-500/10 overflow-hidden">
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-b-2xl z-20" />

              {/* TikTok-style feed */}
              <div className="absolute inset-0 pt-6">
                {/* Video background */}
                <div className="absolute inset-0 pt-6 bg-gradient-to-b from-zinc-900 via-zinc-800 to-zinc-900" />

                {/* Top bar */}
                <div className="relative z-10 flex items-center justify-between px-4 pt-2">
                  <span className="text-xs font-semibold text-white">Following</span>
                  <span className="text-xs text-zinc-400">For You</span>
                </div>

                {/* Animated template badge */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.8, duration: 0.4 }}
                  className="absolute top-14 left-4 z-10 px-2.5 py-1 rounded-full bg-red-600/90 text-[10px] font-semibold text-white flex items-center gap-1.5"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Template
                </motion.div>

                {/* Song info overlay */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1, duration: 0.4 }}
                  className="absolute bottom-24 left-4 z-10"
                >
                  <p className="text-sm font-bold text-white">@artistname</p>
                  <p className="text-xs text-zinc-300 mt-0.5">
                    Original sound - Artist Name
                  </p>
                </motion.div>

                {/* Right side action icons */}
                <div className="absolute bottom-28 right-3 z-10 flex flex-col items-center gap-4">
                  {[
                    { icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z", label: "12.4K" },
                    { icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z", label: "843" },
                    { icon: "M4 16v6h16v-6M4 14l8-10 8 10", label: "Share" },
                  ].map((action, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1.2 + i * 0.1, duration: 0.3 }}
                      className="flex flex-col items-center gap-0.5"
                    >
                      <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={action.icon} />
                        </svg>
                      </div>
                      <span className="text-[9px] text-zinc-400">{action.label}</span>
                    </motion.div>
                  ))}
                </div>

                {/* Animated pulsing waveform at bottom */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                  className="absolute bottom-4 left-4 right-4 z-10"
                >
                  <div className="flex items-center gap-0.5 h-6">
                    {Array.from({ length: 30 }).map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{
                          height: [4, 12 + Math.sin(i * 0.5) * 8, 4],
                        }}
                        transition={{
                          duration: 0.6 + Math.sin(i * 0.3) * 0.2,
                          repeat: Infinity,
                          delay: i * 0.03,
                        }}
                        className="w-0.5 bg-red-500/70 rounded-full"
                        style={{ height: 4 }}
                      />
                    ))}
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Glow behind phone */}
            <div className="absolute -inset-4 bg-red-500/10 rounded-[4rem] blur-3xl -z-10" />
          </div>
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />
    </section>
  );
}

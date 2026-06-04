"use client";

import { motion } from "framer-motion";

export default function FinalCTA() {
  return (
    <section id="start" className="relative py-16 sm:py-32">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-600/8 rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-[1.1]">
            Ready To Push Your{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600">
              Music Further
            </span>
            ?
          </h2>
          <p className="mt-5 text-base sm:text-lg text-zinc-400 max-w-lg mx-auto">
            Join dozens of artists who are growing their audience through
            viral CapCut template campaigns.
          </p>

          <motion.div
            className="mt-10"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <a
              href="/campaign"
              className="relative inline-flex group px-10 py-4 rounded-full bg-red-600 hover:bg-red-500 text-white font-semibold text-base transition-all duration-200 hover:shadow-2xl hover:shadow-red-500/40"
            >
              <span className="relative z-10">Start Your Campaign</span>
              <div className="absolute inset-0 rounded-full bg-red-400 blur-xl opacity-0 group-hover:opacity-40 transition-opacity duration-300" />
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="mt-5 text-sm text-zinc-500"
          >
            No commitment required. We&apos;ll discuss your vision first.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}

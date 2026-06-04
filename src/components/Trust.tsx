"use client";

import { motion } from "framer-motion";

const brands = [
  {
    name: "BennyEdits",
    tagline: "Trending CapCut Creator",
    gradient: "from-purple-500/20 to-purple-600/10",
    border: "border-purple-500/20",
    glow: "shadow-purple-500/10",
  },
  {
    name: "SharpConnect",
    tagline: "Viral Template Network",
    gradient: "from-red-500/20 to-red-600/10",
    border: "border-red-500/20",
    glow: "shadow-red-500/10",
  },
  {
    name: "CapCutAfrica",
    tagline: "African Music Movement",
    gradient: "from-orange-500/20 to-orange-600/10",
    border: "border-orange-500/20",
    glow: "shadow-orange-500/10",
  },
  {
    name: "SharpEditz",
    tagline: "High-Impact Edits",
    gradient: "from-blue-500/20 to-blue-600/10",
    border: "border-blue-500/20",
    glow: "shadow-blue-500/10",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

export default function Trust() {
  return (
    <section className="relative py-16 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Promotion Across{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600">
              Top TikTok Pages
            </span>
          </h2>
          <p className="mt-3 text-zinc-400 max-w-lg mx-auto text-sm sm:text-base">
            Your campaign runs on our network of high-performing TikTok template
            accounts.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5"
        >
          {brands.map((brand) => (
            <motion.div
              key={brand.name}
              variants={cardVariants}
              className="group relative"
            >
              <div
                className={`relative overflow-hidden rounded-2xl border ${brand.border} bg-gradient-to-br ${brand.gradient} backdrop-blur-xl p-6 transition-all duration-400 hover:scale-[1.02] ${brand.glow}`}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400" />

                <div className="relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-white/8 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <div className="w-5 h-5 rounded-full bg-white/30" />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-0.5">
                    {brand.name}
                  </h3>
                  <p className="text-sm text-zinc-400">{brand.tagline}</p>
                </div>

                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

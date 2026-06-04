"use client";

import { motion } from "framer-motion";

const packages = [
  {
    name: "Standard Promo",
    price: "GHC 1,000",
    description: "Get your song trending with a single CapCut template.",
    features: [
      "1 CapCut template",
      "Promotion across all 4 pages",
      "Basic analytics report",
      "48-hour turnaround",
    ],
    highlighted: false,
  },
  {
    name: "Promo + Edited Sound",
    price: "GHC 1,300",
    description: "Includes professionally edited audio for maximum impact.",
    features: [
      "1 CapCut template",
      "Promotion across all 4 pages",
      "Slow/fast sound edits",
      "Priority placement",
      "24-hour turnaround",
    ],
    highlighted: true,
  },
  {
    name: "Additional Repost Boost",
    price: "GHC 1,000",
    description: "Extend your campaign with an extra repost cycle.",
    features: [
      "Extra repost campaign cycle",
      "Fresh template variant",
      "Cross-platform reposting",
      "Extended reach analytics",
    ],
    highlighted: false,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="relative py-16 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Choose Your{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600">
              Package
            </span>
          </h2>
          <p className="mt-3 text-zinc-400 max-w-lg mx-auto text-sm sm:text-base">
            Transparent pricing. No hidden fees. Start promoting your music
            today.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {packages.map((pkg, index) => (
            <motion.div
              key={pkg.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className={`relative group ${
                pkg.highlighted ? "md:-mt-4 md:-mb-4" : ""
              }`}
            >
              <div
                className={`relative h-full rounded-2xl border p-6 sm:p-8 backdrop-blur-xl transition-all duration-300 ${
                  pkg.highlighted
                    ? "border-red-500/30 bg-red-500/[0.06] shadow-xl shadow-red-500/10"
                    : "border-white/[0.06] bg-white/[0.03] hover:border-white/[0.12]"
                }`}
              >
                {pkg.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-red-600 text-xs font-semibold text-white">
                    Most Popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white mb-1.5">
                    {pkg.name}
                  </h3>
                  <p className="text-sm text-zinc-400">{pkg.description}</p>
                </div>

                <div className="mb-6">
                  <span className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                    {pkg.price}
                  </span>
                </div>

                <ul className="space-y-2.5 mb-8">
                  {pkg.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-zinc-300">
                      <svg
                        className="w-4 h-4 text-red-400 shrink-0 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>

                <a
                  href="/campaign"
                  className={`block w-full text-center py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                    pkg.highlighted
                      ? "bg-red-600 hover:bg-red-500 text-white hover:shadow-lg hover:shadow-red-500/25"
                      : "border border-white/[0.1] text-white hover:bg-white/[0.04]"
                  }`}
                >
                  Get Started
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

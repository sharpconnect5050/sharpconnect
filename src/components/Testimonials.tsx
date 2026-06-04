"use client";

import { motion } from "framer-motion";

const avatarColors = [
  "from-red-500 to-rose-700",
  "from-purple-500 to-indigo-700",
  "from-orange-500 to-amber-700",
  "from-blue-500 to-cyan-700",
];

const testimonials = [
  {
    quote:
      "SharpConnect got my track trending in less than 48 hours. The CapCut templates were fire and the engagement was insane.",
    author: "Lasmid",
    role: "Afrobeat Artist",
  },
  {
    quote:
      "I've tried other promo services but nothing compares. The templates actually look professional, not spammy.",
    author: "Guchi",
    role: "Afro-pop Artist",
  },
  {
    quote:
      "The repost boost brought my song back to life. Got thousands of new ears on my music in just one week.",
    author: "Olive The Boy",
    role: "Afro-fusion Artist",
  },
  {
    quote:
      "Working with a team that understands both TikTok trends and music quality is rare. Highly recommend.",
    author: "Victony",
    role: "Afrobeat Artist",
  },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function Testimonials() {
  return (
    <section className="relative py-16 sm:py-32">
      <div className="absolute inset-0 bg-gradient-to-b from-black via-red-950/5 to-black" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            What Artists{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600">
              Say
            </span>
          </h2>
          <p className="mt-3 text-zinc-400 max-w-lg mx-auto text-sm sm:text-base">
            Real feedback from musicians who have grown their reach with our
            platform.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 max-w-4xl mx-auto">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.author}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <div className="h-full rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-6 transition-all duration-300 hover:border-white/[0.12]">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <svg
                      key={j}
                      className="w-3.5 h-3.5 text-red-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>

                <p className="text-sm sm:text-base text-zinc-300 leading-relaxed mb-6">
                  &ldquo;{t.quote}&rdquo;
                </p>

                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColors[i]} flex items-center justify-center text-[10px] font-bold text-white`}>
                    {initials(t.author)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{t.author}</p>
                    <p className="text-xs text-zinc-500">{t.role}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

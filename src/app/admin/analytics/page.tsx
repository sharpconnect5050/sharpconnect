"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { getCampaigns, formatCurrency, type Campaign } from "@/lib/adminData";

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-28 text-right text-zinc-400 shrink-0">{label}</span>
      <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full bg-gradient-to-r ${color}`}
        />
      </div>
      <span className="w-16 text-zinc-300 font-medium">{value}</span>
    </div>
  );
}

export default function AnalyticsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getCampaigns().then((d) => { if (mounted) setCampaigns(d); }).catch(console.error).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const revenueByMonth: Record<string, number> = {};
  const campaignsByWeek: Record<string, number> = {};
  const packageCount: Record<string, number> = {};
  let total = 0;
  let paid = 0;

  campaigns.forEach((c) => {
    const d = new Date(c.submittedAt);
    const month = d.toLocaleString("en-GB", { month: "short", year: "2-digit" });
    revenueByMonth[month] = (revenueByMonth[month] || 0) + c.total;
    const week = `${d.getFullYear()}-W${String(Math.ceil((d.getDate() + (d.getDay() === 0 ? 6 : d.getDay() - 1)) / 7)).padStart(2, "0")}`;
    campaignsByWeek[week] = (campaignsByWeek[week] || 0) + 1;
    packageCount[c.packageName] = (packageCount[c.packageName] || 0) + 1;
    total++;
    if (c.status !== "Pending Verification" && c.status !== "Rejected") paid++;
  });

  const months = Object.keys(revenueByMonth).slice(-6);
  const weeks = Object.keys(campaignsByWeek).slice(-8);
  const maxRevenue = Math.max(...Object.values(revenueByMonth), 1);
  const maxWeek = Math.max(...Object.values(campaignsByWeek), 1);
  const maxPkg = Math.max(...Object.values(packageCount), 1);
  const conversionRate = total > 0 ? Math.round((paid / total) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-zinc-500 mt-1">Campaign performance metrics</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Campaigns", value: total, color: "from-blue-500 to-blue-600" },
          { label: "Paid Campaigns", value: paid, color: "from-green-500 to-green-600" },
          { label: "Conversion Rate", value: `${conversionRate}%`, color: "from-purple-500 to-purple-600" },
          { label: "Total Revenue", value: formatCurrency(campaigns.reduce((s, c) => s + c.total, 0)), color: "from-red-500 to-red-600" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-4"
          >
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${s.color}`}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6"
        >
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-6">Revenue Over Time</h3>
          <div className="space-y-3">
            {months.map((m) => (
              <Bar key={m} label={m} value={revenueByMonth[m]} max={maxRevenue} color="from-red-500 to-red-600" />
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6"
        >
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-6">Campaigns Per Week</h3>
          <div className="space-y-3">
            {weeks.map((w) => (
              <Bar key={w} label={w} value={campaignsByWeek[w]} max={maxWeek} color="from-blue-500 to-blue-600" />
            ))}
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6"
      >
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-6">Most Popular Packages</h3>
        <div className="space-y-3">
          {Object.entries(packageCount).map(([name, count]) => (
            <Bar key={name} label={name} value={count} max={maxPkg} color="from-purple-500 to-purple-600" />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

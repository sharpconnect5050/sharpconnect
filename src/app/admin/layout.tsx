"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import AdminNotificationBell from "@/components/AdminNotifications";
import AIAssistant from "@/components/AIAssistant";
import ThemeToggle from "@/components/ThemeToggle";
import { ThemeProvider } from "@/lib/theme-context";
import { isTestMode, seedTestData } from "@/lib/test-mode";

const tabs: { id: string; label: string; icon: string; href: string; minRole?: string }[] = [
  { id: "overview", label: "Command Center", icon: "", href: "/admin", minRole: "viewer" },
  { id: "operations", label: "Operations", icon: "⚡", href: "/admin/operations", minRole: "viewer" },
  { id: "campaigns", label: "Campaigns", icon: "", href: "/admin/campaigns", minRole: "viewer" },
  { id: "scheduling", label: "Schedule", icon: "", href: "/admin/scheduling", minRole: "viewer" },
  { id: "editors", label: "Editors", icon: "", href: "/admin/editors", minRole: "viewer" },
  { id: "payments", label: "Payments", icon: "", href: "/admin/payments", minRole: "admin" },
  { id: "reviews", label: "Reviews", icon: "", href: "/admin/reviews", minRole: "admin" },
  { id: "kanban", label: "Pipeline", icon: "", href: "/admin/kanban", minRole: "viewer" },
  { id: "automation", label: "Automation", icon: "", href: "/admin/automation", minRole: "admin" },
  { id: "logs", label: "Activity Log", icon: "", href: "/admin/logs", minRole: "viewer" },
  { id: "analytics", label: "Analytics", icon: "", href: "/admin/analytics", minRole: "viewer" },
];

const SIDEBAR_ICONS: Record<string, string> = {
  operations:
    '<svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"/></svg>',
  commandCenter:
    '<svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>',
  campaigns:
    '<svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/></svg>',
  schedule:
    '<svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/></svg>',
  editors:
    '<svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>',
  payments:
    '<svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"/></svg>',
  reviews:
    '<svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"/></svg>',
  pipeline:
    '<svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z"/></svg>',
  automation:
    '<svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"/></svg>',
  events:
    '<svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>',
  analytics:
    '<svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>',
};

const mobileTabs: { id: string; label: string; icon: string; href: string; minRole?: string }[] = [
  { id: "overview", label: "Home", icon: "", href: "/admin", minRole: "viewer" },
  { id: "operations", label: "Ops", icon: "⚡", href: "/admin/operations", minRole: "viewer" },
  { id: "campaigns", label: "Campaigns", icon: "", href: "/admin/campaigns", minRole: "viewer" },
  { id: "scheduling", label: "Schedule", icon: "", href: "/admin/scheduling", minRole: "viewer" },
  { id: "editors", label: "Editors", icon: "", href: "/admin/editors", minRole: "viewer" },
  { id: "payments", label: "Payments", icon: "", href: "/admin/payments", minRole: "admin" },
  { id: "reviews", label: "Reviews", icon: "", href: "/admin/reviews", minRole: "admin" },
  { id: "kanban", label: "Pipeline", icon: "", href: "/admin/kanban", minRole: "viewer" },
  { id: "analytics", label: "Analytics", icon: "", href: "/admin/analytics", minRole: "viewer" },
];

type AdminRole = "super_admin" | "admin" | "viewer";
const ROLE_HIERARCHY: Record<AdminRole, number> = { viewer: 0, admin: 1, super_admin: 2 };

function meetsMinRole(userRole: string | undefined, minRole: string | undefined): boolean {
  if (!minRole) return true;
  if (!userRole) return false;
  return (ROLE_HIERARCHY[userRole as AdminRole] ?? -1) >= (ROLE_HIERARCHY[minRole as AdminRole] ?? Infinity);
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [password, setPassword] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;
    if (isTestMode()) seedTestData();
    const storedToken = sessionStorage.getItem("sharpconnect_admin");
    const storedRole = sessionStorage.getItem("sharpconnect_admin_role") as AdminRole | null;
    if (storedToken) {
      fetch("/api/admin-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: storedToken }),
      }).then((r) => r.json()).then((d) => {
        if (!mounted) return;
        if (d.valid) {
          setAuthed(true);
          const resolvedRole = d.role || storedRole || "admin";
          setRole(resolvedRole);
          sessionStorage.setItem("sharpconnect_admin_role", resolvedRole);
        } else {
          sessionStorage.removeItem("sharpconnect_admin");
          sessionStorage.removeItem("sharpconnect_admin_role");
        }
        setChecked(true);
      }).catch(() => {
        if (!mounted) return;
        sessionStorage.removeItem("sharpconnect_admin");
        sessionStorage.removeItem("sharpconnect_admin_role");
        setChecked(true);
      });
    } else {
      setChecked(true);
    }
    return () => { mounted = false; };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/admin-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pwd: password }),
    });
    const data = await res.json();
    if (data.valid && data.token && data.role) {
      setAuthed(true);
      setRole(data.role);
      sessionStorage.setItem("sharpconnect_admin", data.token);
      sessionStorage.setItem("sharpconnect_admin_role", data.role);
      setPassword("");
    }
  };

  if (!checked) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <form onSubmit={handleLogin} className="max-w-sm w-full mx-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center mb-4 mx-auto font-bold text-sm">S</div>
            <h1 className="text-xl font-bold text-center mb-1">Command Center</h1>
            <p className="text-xs text-zinc-500 text-center mb-6">SharpConnect Template Promo</p>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="w-full bg-transparent border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-red-500/50 mb-4"
            />
            <button type="submit"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold text-sm transition-all"
            >
              Access Command Center
            </button>
          </motion.div>
        </form>
      </div>
    );
  }

  const activeTab = pathname === "/admin" ? "overview" : pathname.replace("/admin/", "");
  const testing = isTestMode();

  return (
    <ThemeProvider>
      {testing && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-600 text-center py-1 text-[11px] font-semibold text-black tracking-wide">
          🧪 LOCAL TEST MODE — data is stored in browser only
        </div>
      )}
      <div className={`min-h-screen bg-[var(--admin-bg)] text-[var(--admin-text)] flex ${testing ? "pt-5" : ""}`}>
        {/* ─── SIDEBAR ─── */}
        <aside className={`fixed lg:static ${testing ? "top-5" : "inset-y-0"} left-0 z-50 w-60 bg-[var(--admin-sidebar-bg)] border-r border-[var(--admin-sidebar-border)] transform transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          {/* Logo */}
          <div className="h-16 px-5 border-b border-[var(--admin-sidebar-border)] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center font-bold text-xs relative overflow-hidden">
              <div className="absolute inset-0 bg-[linear-gradient(105deg,transparent_30%,rgba(255,255,255,0.1)_50%,transparent_70%)]" />
              <span className="relative z-10">S</span>
            </div>
            <div>
              <div className="font-semibold text-sm tracking-tight">SharpConnect</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1 h-1 rounded-full bg-emerald-500 live-dot" />
                <span className="text-[9px] text-[var(--admin-bottom-text)] font-medium tracking-wider uppercase">Command Center</span>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="p-3 space-y-0.5">
            {tabs.filter((t) => meetsMinRole(role ?? undefined, t.minRole)).map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <a
                  key={tab.id}
                  href={tab.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 relative ${
                    isActive
                      ? "text-[var(--admin-nav-active-text)] bg-[var(--admin-nav-active-bg)] border border-[var(--admin-nav-active-border)]"
                      : "text-[var(--admin-nav-text)] hover:text-[var(--admin-nav-text-hover)] hover:bg-[var(--admin-nav-bg-hover)]"
                  }`}
                >
                  {isActive && (
                    <motion.div layoutId="sidebar-active" className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-red-500"
                      style={{ boxShadow: "0 0 8px rgba(239,68,68,0.5)" }}
                    />
                  )}
                  <span
                    className="shrink-0"
                    dangerouslySetInnerHTML={{ __html: SIDEBAR_ICONS[tab.id === "overview" ? "commandCenter" : tab.id === "scheduling" ? "schedule" : tab.id === "kanban" ? "pipeline" : tab.id === "logs" ? "events" : tab.id] || "" }}
                  />
                  <span className="font-medium">{tab.label}</span>
                </a>
              );
            })}
          </nav>

          {/* Bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-[var(--admin-sidebar-border)]">
            <a href="/" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs text-[var(--admin-bottom-text)] hover:text-[var(--admin-bottom-text-hover)] hover:bg-[var(--admin-bottom-bg-hover)] transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Site
            </a>
          </div>
        </aside>

        {sidebarOpen && <div className="fixed inset-0 bg-[var(--admin-overlay)] z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

        {/* ─── MAIN ─── */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 bg-[var(--admin-header-bg)] backdrop-blur-2xl border-b border-[var(--admin-sidebar-border)] min-h-14 h-auto flex items-center px-4 sm:px-6 py-2">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 mr-2 -ml-2 text-[var(--admin-hamburger-text)] hover:text-[var(--admin-hamburger-text-hover)]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            {/* Live indicator */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--admin-live-bg)] border border-[var(--admin-live-border)]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 live-dot" />
              <span className="text-[10px] font-medium text-[var(--admin-live-text)] tracking-wide">LIVE</span>
            </div>

            <div className="flex items-center gap-3 ml-auto">
              <AdminNotificationBell />
              <ThemeToggle />
              <button onClick={() => { setAuthed(false); setRole(null); sessionStorage.removeItem("sharpconnect_admin"); sessionStorage.removeItem("sharpconnect_admin_role"); }}
                className="px-3 py-1.5 rounded-lg text-[11px] text-[var(--admin-logout-text)] hover:text-[var(--admin-logout-text-hover)] hover:bg-[var(--admin-nav-bg-hover)] transition-all border border-transparent hover:border-[var(--admin-logout-border-hover)]">
                Logout
              </button>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 overflow-auto">{children}</main>
        </div>

        <AIAssistant />

        {/* ─── MOBILE BOTTOM NAV ─── */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-[var(--admin-mobile-bg)] backdrop-blur-2xl border-t border-[var(--admin-sidebar-border)] safe-area-bottom">
          <div className="flex items-center justify-around h-14 px-1">
            {mobileTabs.filter((t) => meetsMinRole(role ?? undefined, t.minRole)).map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <a key={tab.id} href={tab.href}
                  className="flex flex-col items-center justify-center gap-0.5 min-w-0 px-2 py-1 relative"
                >
                  {isActive && (
                    <motion.div layoutId="mobile-indicator" className="absolute -top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-red-500" />
                  )}
                  <span className={`text-lg ${isActive ? "text-red-500" : "text-[var(--admin-mobile-nav-text)]"}`}>{tab.icon}</span>
                  <span className={`text-[10px] font-medium ${isActive ? "text-red-500" : "text-[var(--admin-mobile-nav-text)]"}`}>{tab.label}</span>
                </a>
              );
            })}
          </div>
        </nav>
      </div>
    </ThemeProvider>
  );
}

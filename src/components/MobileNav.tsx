"use client";

import { usePathname } from "next/navigation";

const tabs = [
  { label: "Home", href: "/", icon: "HouseIcon" },
  { label: "Packages", href: "/#pricing", icon: "TagIcon" },
  { label: "Submit", href: "/campaign", icon: "UploadIcon" },
  { label: "Track", href: "/track", icon: "SearchIcon" },
  { label: "Support", href: "https://wa.me/233552783151?text=Hi%20SharpConnect%2C%20I%20need%20help%20with%20my%20campaign.", icon: "ChatIcon", external: true },
];

function TabIcon({ name, active }: { name: string; active: boolean }) {
  const cls = active ? "text-red-500" : "text-zinc-500";
  if (name === "HouseIcon") return <svg className="w-5 h-5" fill={active ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
  if (name === "TagIcon") return <svg className="w-5 h-5" fill={active ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" /></svg>;
  if (name === "UploadIcon") return <svg className="w-5 h-5" fill={active ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 1.5} d="M12 4v16m8-8H4" /></svg>;
  if (name === "SearchIcon") return <svg className="w-5 h-5" fill={active ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
  if (name === "ChatIcon") return <svg className="w-5 h-5" fill={active ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>;
  return null;
}

export default function MobileNav() {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) return null;

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href.startsWith("/#")) return false;
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-black/95 backdrop-blur-xl border-t border-white/10 safe-area-bottom">
      <div className="flex items-center justify-around h-14 px-1">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          const link = (
            <a
              key={tab.label}
              href={tab.href}
              {...(tab.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 h-full px-1 active:bg-white/[0.03] transition-colors rounded-md"
            >
              <TabIcon name={tab.icon} active={active} />
              <span className={`text-[10px] font-medium ${active ? "text-red-500" : "text-zinc-500"}`}>
                {tab.label}
              </span>
            </a>
          );
          return link;
        })}
      </div>
    </nav>
  );
}

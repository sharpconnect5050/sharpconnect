"use client";

import MobileNav from "./MobileNav";
import WhatsAppButton from "./WhatsAppButton";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <MobileNav />
      <WhatsAppButton />
    </>
  );
}

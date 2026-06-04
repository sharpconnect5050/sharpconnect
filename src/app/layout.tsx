import type { Metadata } from "next";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";
import { validateEnv } from "@/lib/config";

validateEnv();

export const metadata: Metadata = {
  title: "SharpConnect Template Promo | Turn Your Song Into a Viral TikTok Trend",
  description:
    "Promote your music with high-quality TikTok edit campaigns designed to increase visibility and engagement.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}

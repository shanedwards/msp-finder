import type { Metadata } from "next";
import "./globals.css";
import { ProfileProvider } from "@/contexts/profile-context";
import Link from "next/link";
import { Suspense } from "react";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "MSP Finder",
  description: "Internal tool for researching and reviewing MSP leads",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased bg-slate-50 text-slate-900">
        <ProfileProvider>
          <nav className="w-full bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
            <div className="w-full max-w-7xl mx-auto flex justify-between items-center h-14 px-5">
              <Link
                href="/dashboard"
                className="flex items-center gap-2.5 group"
              >
                <div className="w-7 h-7 rounded-md bg-blue-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold leading-none">M</span>
                </div>
                <span className="text-white font-semibold text-sm tracking-tight">
                  MSP Finder
                </span>
                <span className="text-slate-500 text-xs hidden sm:inline">
                  — Internal Sales Tool
                </span>
              </Link>
              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard"
                  className="text-slate-400 hover:text-white text-xs font-medium transition-colors px-2 py-1 rounded hover:bg-slate-800"
                >
                  Dashboard
                </Link>
              </div>
            </div>
          </nav>
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-slate-400 text-sm">Loading...</div>
            </div>
          }>
            {children}
          </Suspense>
        </ProfileProvider>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { CommandPalette } from "@/components/ui/command-palette";
import { Freshness } from "@/components/ui/freshness";
import { NavLinks } from "@/components/ui/nav-links";
import { THEME_SCRIPT, ThemeToggle } from "@/components/ui/theme-toggle";
import { getSiteData } from "@/lib/data";
import "./globals.css";

// next/font self-hosts and emits size-adjusted fallbacks, so font swap causes no layout shift.
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });
const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "https://eip-radar.vercel.app"),
  twitter: { card: "summary_large_image" },
  title: { default: "EIP Radar — the Ethereum Core roadmap, tracked", template: "%s · EIP Radar" },
  description:
    "Every Core Ethereum Improvement Proposal, synced from ethereum/EIPs every 6 hours: what ships next, what is moving, and what died.",
  alternates: { types: { "application/rss+xml": "/feed.xml" } },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1014" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { snapshot, checkedAt, mode, error } = await getSiteData();
  return (
    <html lang="en" suppressHydrationWarning className={`${archivo.variable} ${plex.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="display flex items-center gap-2 text-lg font-extrabold no-underline">
              <RadarMark />
              EIP Radar
            </Link>
            <NavLinks />
            <div className="ml-auto flex items-center gap-2">
              <CommandPalette />
              <ThemeToggle />
            </div>
          </div>
          <div className="mx-auto max-w-[1200px] px-4 pb-2.5">
            <Freshness initial={{ commitSha: snapshot.source.commitSha, checkedAt, mode, error }} />
          </div>
        </header>
        <main id="main" className="mx-auto max-w-[1200px] px-4 py-8">
          {children}
        </main>
        <footer className="mt-16 border-t border-line">
          <div className="mx-auto flex max-w-[1200px] flex-wrap gap-x-6 gap-y-2 px-4 py-6 text-sm text-muted">
            <span>Data: ethereum/EIPs (CC0). Core EIPs only.</span>
            <Link href="/about">Method &amp; caveats</Link>
            <a href="/feed.xml">RSS</a>
            <a href="/api/changes">JSON</a>
          </div>
        </footer>
      </body>
    </html>
  );
}

function RadarMark() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden>
      <circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="4.5" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <path d="M10 10 L17 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="14" cy="13" r="1.6" fill="var(--track-surge)" />
    </svg>
  );
}

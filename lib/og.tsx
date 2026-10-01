// Shared layout for Open Graph cards (1200×630), rendered by next/og.

import type { ReactNode } from "react";

export const OG_SIZE = { width: 1200, height: 630 };

const TRACK_HEX: Record<string, string> = {
  merge: "#3987e5",
  surge: "#eb6834",
  scourge: "#1baf7a",
  verge: "#eda100",
  purge: "#e87ba4",
  splurge: "#1f9a1f",
  legacy: "#a3a39c",
};
export const trackHex = (t: string) => TRACK_HEX[t] ?? "#a3a39c";

export function OgFrame({ eyebrow, title, children, accent = "#eb6834" }: { eyebrow: string; title: string; children?: ReactNode; accent?: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0d1014", color: "#e6e9ee", padding: 64, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, fontWeight: 700 }}>
        <div style={{ width: 22, height: 22, borderRadius: 11, border: "3px solid #e6e9ee", display: "flex" }} />
        EIP Radar
      </div>
      <div style={{ display: "flex", marginTop: 56, fontSize: 26, letterSpacing: 3, textTransform: "uppercase", color: "#a0a9b5" }}>{eyebrow}</div>
      <div style={{ display: "flex", marginTop: 12, fontSize: title.length > 40 ? 64 : 84, fontWeight: 800, lineHeight: 1.05, maxWidth: 1050 }}>{title}</div>
      <div style={{ display: "flex", flex: 1 }} />
      {children}
      <div style={{ display: "flex", height: 10, marginTop: 36, background: accent, borderRadius: 5 }} />
    </div>
  );
}

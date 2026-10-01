import { ImageResponse } from "next/og";
import { getSiteData } from "@/lib/data";
import { OG_SIZE, OgFrame } from "@/lib/og";
import { nextUpgrade, summarise } from "@/lib/summary";

export const alt = "EIP Radar — every Core Ethereum Improvement Proposal, tracked";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 21600;

export default async function Image() {
  const { snapshot } = await getSiteData();
  const sum = summarise(snapshot);
  const next = nextUpgrade(snapshot.upgrades);
  const stats: [string, string | number][] = [
    ["Core EIPs", sum.total],
    ["In motion", sum.inMotion],
    ["Final", sum.byStatus.Final],
    ["Died", `${Math.round((sum.dead / sum.total) * 100)}%`],
  ];
  return new ImageResponse(
    (
      <OgFrame eyebrow={next ? "Next upgrade" : "Ethereum roadmap"} title={next ? next.name : "Every Core EIP, tracked"}>
        <div style={{ display: "flex", gap: 64 }}>
          {stats.map(([k, v]) => (
            <div key={k} style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 22, color: "#a0a9b5", textTransform: "uppercase", letterSpacing: 2 }}>{k}</div>
              <div style={{ display: "flex", fontSize: 56, fontWeight: 700 }}>{String(v)}</div>
            </div>
          ))}
        </div>
      </OgFrame>
    ),
    size,
  );
}

import { ImageResponse } from "next/og";
import { getSiteData } from "@/lib/data";
import { eipMap, upgradeMembers, upgradeStatus } from "@/lib/derive";
import { mainnetTimestamp } from "@/lib/forks";
import { fmtDate } from "@/lib/format";
import { OG_SIZE, OgFrame, trackHex } from "@/lib/og";

export const alt = "Ethereum network upgrade on EIP Radar";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 21600;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { snapshot } = await getSiteData();
  const u = snapshot.upgrades.find((x) => x.slug === slug);
  if (!u) return new ImageResponse(<OgFrame eyebrow="Upgrade" title="Not found" />, size);
  const members = upgradeMembers(u, eipMap(snapshot)).filter((m) => m.stage === "Scheduled");
  const ts = mainnetTimestamp(u);
  const state = upgradeStatus(u);
  return new ImageResponse(
    (
      <OgFrame eyebrow={`Network upgrade · ${state}`} title={u.name}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontSize: 32, color: "#a0a9b5" }}>
            {`${members.length} Core EIPs · mainnet ${ts ? fmtDate(ts) : "not set"}`}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxWidth: 1070 }}>
            {members.slice(0, 40).map((m) => (
              <div key={m.eip} style={{ display: "flex", fontSize: 20, padding: "4px 10px", borderRadius: 6, background: trackHex(m.track), color: "#0d1014", fontWeight: 700 }}>
                {m.eip}
              </div>
            ))}
          </div>
        </div>
      </OgFrame>
    ),
    size,
  );
}

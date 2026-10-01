import { ImageResponse } from "next/og";
import { TRACK_LABEL } from "@/lib/colors";
import { getSiteData } from "@/lib/data";
import { memberships } from "@/lib/derive";
import { OG_SIZE, OgFrame, trackHex } from "@/lib/og";

export const alt = "Core EIP on EIP Radar";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 21600;

export default async function Image({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  const { snapshot } = await getSiteData();
  const e = snapshot.eips.find((x) => x.eip === Number(n));
  if (!e) return new ImageResponse(<OgFrame eyebrow={`EIP-${n}`} title="Not a Core EIP" />, size);
  const ms = memberships(e.eip, snapshot.upgrades);
  const latest = ms[ms.length - 1];
  const facts = [e.status, TRACK_LABEL[e.track], latest ? `${latest.name} · ${latest.status === "shipped" ? "Shipped" : latest.stage}` : null].filter(Boolean) as string[];
  return new ImageResponse(
    (
      <OgFrame eyebrow={`EIP-${e.eip}`} title={e.title.length > 90 ? `${e.title.slice(0, 88)}…` : e.title} accent={trackHex(e.track)}>
        <div style={{ display: "flex", gap: 16 }}>
          {facts.map((f) => (
            <div key={f} style={{ display: "flex", fontSize: 30, padding: "8px 20px", border: "2px solid #3d4652", borderRadius: 999 }}>
              {f}
            </div>
          ))}
        </div>
      </OgFrame>
    ),
    size,
  );
}

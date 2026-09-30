import { describeEvent } from "@/lib/events";
import { getSiteData } from "@/lib/data";

export const revalidate = 21600;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET(req: Request) {
  const origin = process.env.SITE_URL ?? new URL(req.url).origin;
  const { changes, snapshot } = await getSiteData();
  const names = new Map(snapshot.upgrades.map((u) => [u.slug, u.name]));
  const events = [...changes].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 100);

  const items = events
    .map((e, i) => {
      const d = describeEvent(e, (s) => names.get(s) ?? s);
      const title = `${d.eip ? `EIP-${d.eip} ` : ""}${d.subject ? `${d.subject}: ` : ""}${d.text}`;
      const link = d.eip ? `${origin}/eips/${d.eip}` : "upgrade" in e ? `${origin}/upgrades/${e.upgrade}` : origin;
      const guid = `${e.commit}:${e.type}:${"eip" in e ? e.eip : ""}:${"upgrade" in e ? e.upgrade : ""}:${"network" in e ? e.network : ""}:${i}`;
      return `    <item>
      <title>${esc(title)}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="false">${esc(guid)}</guid>
      <pubDate>${new Date(e.at).toUTCString()}</pubDate>
      <description>${esc(`${title}. Commit ${e.commit.slice(0, 7)} in ethereum/EIPs.`)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>EIP Radar — Core EIP changes</title>
    <link>${esc(origin)}</link>
    <atom:link href="${esc(origin)}/feed.xml" rel="self" type="application/rss+xml" />
    <description>Status changes, new Core EIPs, fork inclusion moves and activation dates, synced from ethereum/EIPs.</description>
    <lastBuildDate>${new Date(snapshot.generatedAt).toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}

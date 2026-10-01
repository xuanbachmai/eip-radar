import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section } from "@/components/ui/stat";
import { StagePill } from "@/components/ui/pills";
import { AgeBeeswarm } from "@/components/viz/age-beeswarm";
import { BlobCapacity } from "@/components/viz/blob-capacity";
import { HighlightProvider } from "@/components/viz/frame";
import { UpgradeTimeline } from "@/components/viz/upgrade-timeline";
import { trackColor, TRACK_LABEL } from "@/lib/colors";
import { getSiteData } from "@/lib/data";
import { blobSchedule, eipMap, upgradeMembers, upgradeStatus } from "@/lib/derive";
import { mainnetTimestamp } from "@/lib/forks";
import { fmtDate } from "@/lib/format";
import { ageGroups, timelineColumns, trackMix } from "@/lib/views";

export const revalidate = 21600;
export const metadata: Metadata = { title: "Upgrades", description: "Every Ethereum network upgrade from Homestead to Hegotá, with its Core EIPs." };

export default async function UpgradesPage() {
  const { snapshot: s } = await getSiteData();
  const now = Date.now();
  const eips = eipMap(s);
  const list = [...s.upgrades].reverse();

  return (
    <HighlightProvider>
      <PageHeader eyebrow="Network upgrades" title="From Homestead to Hegotá">
        Pre-Berlin membership is static; Dencun onward is parsed from the Hardfork Meta EIPs on every sync, including inclusion stages
        (EIP-7723) and activation tables.
      </PageHeader>

      <UpgradeTimeline columns={timelineColumns(s, now)} caption="Each tile is a Core EIP coloured by roadmap track; dashed columns are not yet on mainnet." />

      <Section id="list" title="All upgrades">
        <ul className="divide-y divide-line border-y border-line">
          {list.map((u) => {
            const members = upgradeMembers(u, eips);
            const state = upgradeStatus(u, now);
            const ts = mainnetTimestamp(u);
            const mix = trackMix(u, eips);
            const stages = ["Scheduled", "Considered", "Proposed", "Declined"] as const;
            return (
              <li key={u.slug} className="grid grid-cols-1 gap-2 py-3 sm:grid-cols-[200px_120px_1fr] sm:items-center">
                <div>
                  <Link href={`/upgrades/${u.slug}`} className="display text-lg font-bold no-underline hover:underline">
                    {u.name}
                  </Link>
                  <div className="text-xs text-muted">{u.kind === "bpo" ? "Blob-parameter-only fork" : u.metaEip ? `Meta EIP-${u.metaEip}` : "Static membership"}</div>
                </div>
                <div className="num text-sm">
                  {ts ? fmtDate(ts) : <span className="text-muted">not set</span>}
                  <div className="text-xs text-muted">{state}</div>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  {stages.map((st) => {
                    const n = members.filter((m) => m.stage === st).length;
                    return n ? (
                      <span key={st} className="inline-flex items-center gap-1.5">
                        <StagePill stage={st} shipped={state === "shipped"} />
                        <span className="num">{n}</span>
                      </span>
                    ) : null;
                  })}
                  {u.blobParams ? (
                    <span className="num text-muted">
                      blobs {u.blobParams.target ?? "TBD"}/{u.blobParams.max ?? "TBD"}
                    </span>
                  ) : null}
                  {mix.length ? (
                    <span className="flex h-2 w-28 overflow-hidden rounded-sm" role="img" aria-label={`Track mix: ${mix.map((m) => `${TRACK_LABEL[m.track]} ${m.n}`).join(", ")}`}>
                      {mix.map((m) => (
                        <span key={m.track} style={{ flex: m.n, backgroundColor: trackColor(m.track) }} />
                      ))}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section id="blobs" eyebrow="Surge" title="Blob capacity per block">
        <BlobCapacity steps={blobSchedule(s.upgrades)} now={now} />
      </Section>

      <Section id="lead-time" eyebrow="Lead time" title="Years from proposal to mainnet">
        <AgeBeeswarm groups={ageGroups(s, now)} />
      </Section>
    </HighlightProvider>
  );
}

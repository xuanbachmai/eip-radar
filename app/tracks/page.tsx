import type { Metadata } from "next";
import Link from "next/link";
import { LINEAGES } from "@/config/lineages";
import { TRACK_META } from "@/config/tracks";
import { PageHeader, Section } from "@/components/ui/stat";
import { AuthorActivity } from "@/components/viz/author-activity";
import { CreationStream } from "@/components/viz/creation-stream";
import { LineageChains, resolveLineage } from "@/components/viz/lineage-chains";
import { TrackStatusMatrix } from "@/components/viz/track-status-matrix";
import { trackColor } from "@/lib/colors";
import { getSiteData } from "@/lib/data";
import { authorActivity, creationByYear, eipMap } from "@/lib/derive";
import { summarise } from "@/lib/summary";
import { TRACKS } from "@/lib/types";
import { matrixRows } from "@/lib/views";

export const revalidate = 21600;
export const metadata: Metadata = { title: "Roadmap tracks", description: "Core EIPs mapped onto Merge, Surge, Scourge, Verge, Purge and Splurge." };

export default async function TracksPage() {
  const { snapshot: s } = await getSiteData();
  const sum = summarise(s);
  const eips = eipMap(s);
  const index = new Map(s.index.map((i) => [i.eip, i]));
  const year = new Date().getUTCFullYear();

  return (
    <>
      <PageHeader eyebrow="Roadmap" title="Tracks">
        Every Core EIP is assigned to exactly one roadmap track, by a hand-reviewed map with a rule-based fallback for new proposals.{" "}
        <Link href="/about#classification">How classification works</Link>.
      </PageHeader>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TRACKS.map((t) => (
          <li key={t}>
            <Link href={`/tracks/${t}`} className="block h-full rounded border border-line bg-surface p-3 no-underline hover:border-line-strong">
              <div className="flex items-center gap-2">
                <span aria-hidden className="h-3 w-3 rounded-full" style={{ backgroundColor: trackColor(t) }} />
                <span className="display font-bold">{TRACK_META[t].label}</span>
                <span className="num ml-auto text-sm text-muted">{sum.byTrack[t]}</span>
              </div>
              <p className="mt-1 text-xs text-muted">{TRACK_META[t].summary}</p>
            </Link>
          </li>
        ))}
      </ul>

      <Section id="matrix" eyebrow="Status" title="Status mix per track">
        <TrackStatusMatrix rows={matrixRows(s.eips)} caption="Each bar is 100% of a track's Core EIPs; totals on the right." />
      </Section>

      <Section id="creation" eyebrow="Inflow" title="Proposals created per year">
        <CreationStream all={creationByYear(s.eips, TRACKS)} survivors={creationByYear(s.eips, TRACKS, true)} currentYear={year} />
      </Section>

      <Section id="lineages" eyebrow="What replaced what" title="Lineages">
        <LineageChains chains={LINEAGES.map((l) => ({ lineage: l, steps: resolveLineage(l, eips, index) }))} />
      </Section>

      <Section id="authors" eyebrow="People" title="Most active authors">
        <AuthorActivity rows={authorActivity(s.eips, 20)} />
      </Section>
    </>
  );
}

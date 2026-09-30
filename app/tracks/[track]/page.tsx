import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LINEAGES } from "@/config/lineages";
import { TRACK_META } from "@/config/tracks";
import { EipNumber, StagePill, StatusPill } from "@/components/ui/pills";
import { PageHeader, Section, Stat } from "@/components/ui/stat";
import { CreationStream } from "@/components/viz/creation-stream";
import { DependencyGraph } from "@/components/viz/dependency-graph";
import { LineageChains, resolveLineage } from "@/components/viz/lineage-chains";
import { trackColor } from "@/lib/colors";
import { getSiteData } from "@/lib/data";
import { DEAD, IN_MOTION, creationByYear, eipMap, membershipIndex } from "@/lib/derive";
import { TRACKS, type Track } from "@/lib/types";
import { graphData, graphFilters } from "@/lib/views";

export const revalidate = 21600;

type Params = { params: Promise<{ track: string }> };

export function generateStaticParams() {
  return TRACKS.map((track) => ({ track }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { track } = await params;
  const meta = TRACK_META[track as Track];
  return meta ? { title: `${meta.label} track`, description: meta.summary } : {};
}

const GROUPS = [
  { key: "shipped", title: "Shipped", test: (s: string) => s === "Final" },
  { key: "motion", title: "In motion", test: (s: string) => (IN_MOTION as readonly string[]).includes(s) },
  { key: "dead", title: "Dead", test: (s: string) => (DEAD as readonly string[]).includes(s) },
] as const;

export default async function TrackPage({ params }: Params) {
  const { track } = await params;
  if (!(TRACKS as readonly string[]).includes(track)) notFound();
  const t = track as Track;
  const { snapshot: s } = await getSiteData();
  const mine = s.eips.filter((e) => e.track === t);
  const ms = membershipIndex(s.upgrades);
  const eips = eipMap(s);
  const index = new Map(s.index.map((i) => [i.eip, i]));
  const lineages = LINEAGES.filter((l) => l.track === t);
  const year = new Date().getUTCFullYear();

  return (
    <>
      <nav className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Tracks">
        {TRACKS.map((x) => (
          <Link key={x} href={`/tracks/${x}`} aria-current={x === t ? "page" : undefined} className={x === t ? "font-semibold" : "text-muted no-underline hover:underline"}>
            {TRACK_META[x].label}
          </Link>
        ))}
      </nav>
      <PageHeader
        eyebrow="Roadmap track"
        title={
          <span className="inline-flex items-center gap-3">
            <span aria-hidden className="inline-block h-5 w-5 rounded-full" style={{ backgroundColor: trackColor(t) }} />
            {TRACK_META[t].label}
          </span>
        }
      >
        {TRACK_META[t].summary}.
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Core EIPs" value={mine.length} />
        {GROUPS.map((g) => (
          <Stat key={g.key} label={g.title} value={mine.filter((e) => g.test(e.status)).length} />
        ))}
      </div>

      {lineages.length ? (
        <Section id="lineages" title="Lineages">
          <LineageChains chains={lineages.map((l) => ({ lineage: l, steps: resolveLineage(l, eips, index) }))} />
        </Section>
      ) : null}

      <Section id="deps" eyebrow="requires" title="Dependency graph">
        <DependencyGraph eips={graphData(s)} filters={graphFilters(s)} initial={`track:${t}`} />
      </Section>

      <Section id="creation" eyebrow="Inflow" title="Created per year">
        <CreationStream all={creationByYear(mine, [t])} survivors={creationByYear(mine, [t], true)} currentYear={year} />
      </Section>

      {GROUPS.map((g) => {
        const list = mine.filter((e) => g.test(e.status)).sort((a, b) => b.eip - a.eip);
        if (!list.length) return null;
        return (
          <Section key={g.key} id={g.key} title={g.title} aside={String(list.length)}>
            <ul className="divide-y divide-line/70 border-y border-line/70">
              {list.map((e) => {
                const m = ms.get(e.eip);
                const latest = m?.[m.length - 1];
                return (
                  <li key={e.eip} className="grid grid-cols-[72px_1fr] items-baseline gap-x-3 gap-y-1 py-2 text-sm sm:grid-cols-[72px_1fr_110px_200px]">
                    <EipNumber n={e.eip} />
                    <span className="min-w-0">{e.title}</span>
                    <span className="col-start-2 sm:col-start-auto">
                      <StatusPill status={e.status} />
                    </span>
                    <span className="col-start-2 text-muted sm:col-start-auto">
                      {latest ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Link href={`/upgrades/${latest.upgrade}`}>{latest.name}</Link>
                          <StagePill stage={latest.stage} shipped={latest.status === "shipped"} />
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Section>
        );
      })}
    </>
  );
}

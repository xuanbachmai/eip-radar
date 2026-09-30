import Link from "next/link";
import { ChangeFeed } from "@/components/dashboard/change-feed";
import { ChipGrid } from "@/components/dashboard/chip-grid";
import { Countdown } from "@/components/dashboard/countdown";
import { Section, Stat } from "@/components/ui/stat";
import { HighlightProvider } from "@/components/viz/frame";
import { PipelineFlow } from "@/components/viz/pipeline-flow";
import { TrackStatusMatrix } from "@/components/viz/track-status-matrix";
import { UpgradeTimeline } from "@/components/viz/upgrade-timeline";
import { statusColor } from "@/lib/colors";
import { getSiteData } from "@/lib/data";
import { STATUS_ORDER, eipMap, upgradeMembers } from "@/lib/derive";
import { mainnetTimestamp } from "@/lib/forks";
import { fmtDate, fmtDateTimeUtc, pct } from "@/lib/format";
import { nextUpgrade, summarise } from "@/lib/summary";
import { TRACKS } from "@/lib/types";
import { flowCounts, matrixRows, timelineColumns } from "@/lib/views";

export const revalidate = 21600;

export default async function Dashboard() {
  const { snapshot: s, changes } = await getSiteData();
  const now = Date.now();
  const sum = summarise(s, now);
  const next = nextUpgrade(s.upgrades, now);
  const eips = eipMap(s);

  const members = next ? upgradeMembers(next, eips) : [];
  const scheduled = members
    .filter((m) => m.stage === "Scheduled")
    .sort((a, b) => TRACKS.indexOf(a.track) - TRACKS.indexOf(b.track) || a.eip - b.eip);
  const mainnet = next ? mainnetTimestamp(next) : undefined;
  const nextTestnet = next?.activations
    .filter((a) => a.key !== "mainnet" && a.timestamp && a.timestamp * 1000 > now)
    .sort((a, b) => a.timestamp! - b.timestamp!)[0];
  const readiness = STATUS_ORDER.map((st) => ({ status: st, n: scheduled.filter((m) => m.status === st).length })).filter((r) => r.n);
  const weekAgo = new Date(now - 7 * 86_400_000).toISOString();
  const lastWeek = changes.filter((c) => c.at >= weekAgo).length;

  const columns = timelineColumns(s, now);
  const shippedCols = columns.filter((c) => c.state === "shipped");

  return (
    <HighlightProvider>
      {next ? (
        <section aria-labelledby="hero-h" className="rounded-md border border-line bg-surface p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="eyebrow">Next network upgrade</div>
              <h1 id="hero-h" className="display mt-1 text-4xl font-black leading-none sm:text-6xl">
                <Link href={`/upgrades/${next.slug}`} className="no-underline hover:underline">
                  {next.name}
                </Link>
                {next.mascot ? (
                  <span className="ml-3 align-middle text-base font-normal text-muted sm:text-lg" title="Mascot">
                    {next.mascot}
                  </span>
                ) : null}
              </h1>
              <p className="mt-2 text-sm text-muted">
                Hardfork Meta{" "}
                <Link href={`/eips/${next.metaEip}`} className="num">
                  EIP-{next.metaEip}
                </Link>{" "}
                · {scheduled.length} Core EIPs scheduled for inclusion
              </p>
            </div>
            <div className="flex flex-wrap gap-8">
              {mainnet ? (
                <Countdown ts={mainnet} label={`Mainnet · ${fmtDateTimeUtc(mainnet)}`} />
              ) : (
                <div>
                  <div className="eyebrow">Mainnet</div>
                  <div className="mt-1 text-2xl font-semibold">date not set</div>
                </div>
              )}
              {nextTestnet ? <Countdown ts={nextTestnet.timestamp!} label={`${nextTestnet.network} · ${fmtDateTimeUtc(nextTestnet.timestamp!)}`} /> : null}
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="eyebrow">Readiness of scheduled EIPs</h2>
              <span className="text-xs text-muted">{readiness.map((r) => `${r.n} ${r.status}`).join(" · ")}</span>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-sm" role="img" aria-label={`Readiness: ${readiness.map((r) => `${r.n} ${r.status}`).join(", ")}`}>
              {readiness.map((r) => (
                <div key={r.status} style={{ width: `${(r.n / scheduled.length) * 100}%`, backgroundColor: statusColor(r.status) }} className="h-full border-r border-surface last:border-0" />
              ))}
            </div>
          </div>

          <div className="mt-5">
            <ChipGrid chips={scheduled.map((m) => ({ eip: m.eip, title: m.title, track: m.track, status: m.status }))} />
          </div>
        </section>
      ) : null}

      <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Core EIPs" value={sum.total} />
        <Stat label="In motion" value={sum.inMotion} note="Draft · Review · Last Call" />
        <Stat label="Final" value={sum.byStatus.Final} />
        <Stat label="Died" value={pct(sum.dead, sum.total)} note={`${sum.dead} Stagnant or Withdrawn`} />
        <Stat label="Upgrades shipped" value={shippedCols.length} note={`since ${fmtDate(columns[0]?.ts ?? 0)}`} />
        <Stat label="Changes, 7 days" value={lastWeek} />
      </div>

      <div className="mt-12 grid gap-x-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Section id="changes" eyebrow="Change log" title="What changed">
          <ChangeFeed events={changes} upgrades={s.upgrades} />
        </Section>
        <Section id="tracks" eyebrow="Roadmap" title="Status by track" aside={<Link href="/tracks">All tracks →</Link>}>
          <TrackStatusMatrix
            rows={matrixRows(s.eips)}
            caption={`Splurge holds ${sum.byTrack.splurge} of ${sum.total} Core EIPs; Scourge is the youngest track, with ${
              sum.trackStatus.scourge.Draft + sum.trackStatus.scourge.Review
            } of its ${sum.byTrack.scourge} in Draft or Review.`}
          />
        </Section>
      </div>

      <Section id="timeline" eyebrow="2015 → 2027" title="Upgrade timeline" aside={<Link href="/upgrades">All upgrades →</Link>}>
        <UpgradeTimeline
          columns={columns}
          caption={`${shippedCols.length} upgrades shipped; each tile is a Core EIP coloured by roadmap track. Dashed columns are not yet on mainnet; outlined tiles are only Considered.`}
        />
      </Section>

      <Section id="pipeline" eyebrow="Pipeline" title="Where proposals end up">
        <PipelineFlow counts={flowCounts(s.eips)} />
        <p className="mt-3 text-sm text-muted">
          Paths are inferred from current status: the repository records where an EIP is, not the route it took.{" "}
          <Link href="/tracks#lineages">What replaced the dead ones →</Link>
        </p>
      </Section>
    </HighlightProvider>
  );
}

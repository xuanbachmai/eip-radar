import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EipNumber, StagePill, StatusPill, TrackPill } from "@/components/ui/pills";
import { PageHeader, Section, Stat } from "@/components/ui/stat";
import { DataTable } from "@/components/viz/frame";
import { TRACK_LABEL, trackColor } from "@/lib/colors";
import { getSiteData } from "@/lib/data";
import { eipMap, upgradeMembers, upgradeStatus } from "@/lib/derive";
import { mainnetTimestamp } from "@/lib/forks";
import { fmtDate, fmtDateTimeUtc } from "@/lib/format";
import { trackMix } from "@/lib/views";
import type { Stage } from "@/lib/types";

export const revalidate = 21600;

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const { snapshot } = await getSiteData();
  return snapshot.upgrades.map((u) => ({ slug: u.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const { snapshot } = await getSiteData();
  const u = snapshot.upgrades.find((x) => x.slug === slug);
  return { title: u ? u.name : "Upgrade" };
}

const STAGES: Stage[] = ["Scheduled", "Considered", "Proposed", "Declined"];

export default async function UpgradePage({ params }: Params) {
  const { slug } = await params;
  const { snapshot: s } = await getSiteData();
  const u = s.upgrades.find((x) => x.slug === slug);
  if (!u) notFound();
  const now = Date.now();
  const eips = eipMap(s);
  const members = upgradeMembers(u, eips);
  const state = upgradeStatus(u, now);
  const ts = mainnetTimestamp(u);
  const mix = trackMix(u, eips);
  const others = u.eips.filter((m) => !eips.has(m.eip));
  const idx = s.upgrades.findIndex((x) => x.slug === u.slug);
  const [prev, next] = [s.upgrades[idx - 1], s.upgrades[idx + 1]];
  const index = new Map(s.index.map((i) => [i.eip, i]));

  return (
    <>
      <nav className="mb-4 flex justify-between text-sm text-muted" aria-label="Adjacent upgrades">
        {prev ? <Link href={`/upgrades/${prev.slug}`}>← {prev.name}</Link> : <span />}
        {next ? <Link href={`/upgrades/${next.slug}`}>{next.name} →</Link> : <span />}
      </nav>
      <PageHeader
        eyebrow={u.kind === "bpo" ? "Blob-parameter-only fork" : u.kind === "legacy" ? "Network upgrade · static membership" : `Network upgrade · Hardfork Meta EIP-${u.metaEip}`}
        title={
          <>
            {u.name}
            {u.mascot ? <span className="ml-3 align-middle text-lg font-normal text-muted">{u.mascot}</span> : null}
          </>
        }
      >
        {u.parent ? (
          <>
            Scheduled alongside <Link href={`/upgrades/${u.parent}`}>{s.upgrades.find((x) => x.slug === u.parent)?.name}</Link>.{" "}
          </>
        ) : null}
        {u.metaEip ? (
          <>
            Source: <EipNumber n={u.metaEip} /> ({u.metaStatus}).
          </>
        ) : null}
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Mainnet" value={ts ? fmtDate(ts) : "not set"} note={state} />
        <Stat label="Core EIPs" value={members.filter((m) => m.stage === "Scheduled").length} note={state === "shipped" ? "shipped" : "scheduled"} />
        {u.blobParams ? <Stat label="Blobs target / max" value={`${u.blobParams.target ?? "TBD"} / ${u.blobParams.max ?? "TBD"}`} /> : null}
        {members.some((m) => m.stage !== "Scheduled") ? (
          <Stat label="Under consideration" value={members.filter((m) => m.stage === "Considered" || m.stage === "Proposed").length} note="Considered + Proposed" />
        ) : null}
      </div>

      {mix.length ? (
        <Section id="mix" title="Track mix">
          <div className="flex h-4 w-full overflow-hidden rounded-sm" role="img" aria-label={mix.map((m) => `${TRACK_LABEL[m.track]} ${m.n}`).join(", ")}>
            {mix.map((m) => (
              <span key={m.track} style={{ flex: m.n, backgroundColor: trackColor(m.track) }} className="border-r border-surface last:border-0" />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {mix.map((m) => (
              <li key={m.track} className="flex items-center gap-1.5">
                <TrackPill track={m.track} link /> <span className="num text-muted">{m.n}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Across all listed Core EIPs, every stage.</p>
        </Section>
      ) : null}

      {STAGES.map((st) => {
        const list = members.filter((m) => m.stage === st);
        if (!list.length) return null;
        return (
          <Section key={st} id={st.toLowerCase()} title={state === "shipped" && st === "Scheduled" ? "Included EIPs" : `${st} for inclusion`} aside={`${list.length}`}>
            <ul className="divide-y divide-line/70 border-y border-line/70">
              {list.map((m) => (
                <li key={m.eip} className="grid grid-cols-[72px_1fr] items-baseline gap-x-3 gap-y-1 py-2 text-sm sm:grid-cols-[72px_1fr_110px_110px]">
                  <EipNumber n={m.eip} />
                  <span className="min-w-0">{m.title}</span>
                  <span className="col-start-2 sm:col-start-auto">
                    <StatusPill status={m.status} />
                  </span>
                  <span className="col-start-2 sm:col-start-auto">
                    <TrackPill track={m.track} />
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        );
      })}

      {others.length ? (
        <Section id="other" title="Other listed EIPs" aside="Networking, informational — not Core">
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {others.map((m) => (
              <li key={m.eip}>
                <a href={`https://eips.ethereum.org/EIPS/eip-${m.eip}`} className="num">
                  EIP-{m.eip}
                </a>{" "}
                <span className="text-muted">{index.get(m.eip)?.title}</span> <StagePill stage={m.stage} shipped={state === "shipped"} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {u.activations.length ? (
        <Section id="activation" title="Activation">
          <div className="overflow-x-auto">
            <DataTable
              columns={["Network", "Epoch", "Timestamp", "Time (UTC)", "Fork ID"]}
              numeric={[1, 2, 4]}
              rows={u.activations.map((a) => [
                a.network,
                a.epoch ?? "—",
                a.timestamp ?? "—",
                a.timestamp ? fmtDateTimeUtc(a.timestamp) : "not set",
                a.forkId ?? "—",
              ])}
            />
          </div>
          {u.kind === "legacy" ? <p className="mt-2 text-xs text-muted">Pre-Dencun upgrades carry the mainnet date only.</p> : null}
        </Section>
      ) : null}
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { TRACK_META } from "@/config/tracks";
import { PageHeader, Section } from "@/components/ui/stat";
import { TrackPill } from "@/components/ui/pills";
import { getSiteData } from "@/lib/data";
import { fmtDateTimeUtc } from "@/lib/format";
import { TRACKS } from "@/lib/types";

export const revalidate = 21600;
export const metadata: Metadata = { title: "About", description: "Method, classification caveats, update cadence and licence." };

export default async function AboutPage() {
  const { snapshot: s, mode, checkedAt } = await getSiteData();
  const rule = s.eips.filter((e) => e.trackSource === "rule");
  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="About" title="Method and caveats">
        EIP Radar tracks every Core Ethereum Improvement Proposal and explains the state of the roadmap through charts rather than prose.
      </PageHeader>

      <Section id="source" title="Source">
        <p>
          Everything comes from the canonical <a href="https://github.com/ethereum/EIPs">ethereum/EIPs</a> repository, branch <code>master</code>.
          Each sync lists the repository tree, fetches the files whose content changed (pinned to one commit so a sync never mixes versions),
          parses the front matter and keeps proposals with <code>category: Core</code>. ERCs, networking, interface and informational EIPs are out
          of scope.
        </p>
        <p className="mt-3">
          Upgrade membership from Dencun onward is parsed from the Hardfork Meta EIPs (7569, 7600, 7607, 7773, 8081 and the BPO metas 8134, 8135,
          8138): included EIPs, inclusion stages as defined in EIP-7723, activation tables and blob parameters. Upgrades from Homestead to Shapella
          use a static list, because they predate those meta EIPs.
        </p>
      </Section>

      <Section id="cadence" title="Update cadence">
        <ul className="list-disc space-y-1 pl-5">
          <li>A GitHub Action runs the pipeline every 6 hours and commits the snapshot and change log when they differ, so history is diffable.</li>
          <li>The site revalidates every 6 hours and re-checks upstream on demand (“Check now”); if GitHub is unreachable it serves the committed snapshot and says so.</li>
          <li>
            The freshness line turns amber after 12 hours without a successful check and red after 48 hours. Current state:{" "}
            {mode === "live" ? "live" : "committed snapshot"}, last checked {fmtDateTimeUtc(checkedAt)}.
          </li>
          <li>
            Changes are recorded as events (<Link href="/api/changes">JSON</Link>, <a href="/feed.xml">RSS</a>). Status history starts when the
            change log starts; earlier transitions are shown as “date not observed”.
          </li>
        </ul>
      </Section>

      <Section id="classification" title="Track classification">
        <p>
          Each Core EIP gets exactly one track. A hand-reviewed override map covers every Core EIP known at launch; new proposals fall through
          ordered keyword rules, and anything that lands on the Splurge fallback is reported for review. The mapping is an editorial judgement:
          many EIPs plausibly belong to two tracks.
        </p>
        <ul className="mt-3 space-y-1.5">
          {TRACKS.map((t) => (
            <li key={t} className="flex flex-wrap gap-x-3">
              <TrackPill track={t} link />
              <span className="text-sm text-muted">{TRACK_META[t].summary}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">
          Currently {rule.length} of {s.eips.length} Core EIPs are rule-classified
          {rule.length ? `: ${rule.map((e) => `EIP-${e.eip}`).join(", ")}` : ""}.
        </p>
      </Section>

      <Section id="caveats" title="Other caveats">
        <ul className="list-disc space-y-1 pl-5">
          <li>The pipeline flow infers paths from current status; the repository does not record the route a proposal took.</li>
          <li>Lead-time figures measure from an EIP’s <code>created</code> date, which can predate serious work or reflect a later rewrite.</li>
          <li>Author counts treat each co-author equally and match names as written.</li>
          <li>No prices, tokens or governance opinions — by design.</li>
        </ul>
      </Section>

      <Section id="licence" title="Licence">
        <p>
          EIP content is CC0 via ethereum/EIPs. The site source is MIT-licensed. Built with Next.js, D3 and Tailwind CSS.
        </p>
      </Section>
    </div>
  );
}

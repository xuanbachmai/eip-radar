import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EipSummary } from "@/components/ui/eip-summary";
import { Section } from "@/components/ui/stat";
import { statusColor, trackColor } from "@/lib/colors";
import { getSiteData } from "@/lib/data";
import { buildRows, type EipRow } from "@/lib/rows";

export const revalidate = 21600;
// Rendered on first request, then cached (ISR); no need to prebuild 400+ pages.
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

type Params = { params: Promise<{ n: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { n } = await params;
  const { snapshot } = await getSiteData();
  const e = snapshot.eips.find((x) => x.eip === Number(n));
  return e ? { title: `EIP-${e.eip}: ${e.title}`, description: e.description ?? e.abstract } : { title: `EIP-${n}` };
}

export default async function EipPage({ params }: Params) {
  const { n } = await params;
  const num = Number(n);
  if (!/^\d+$/.test(n)) notFound();
  const { snapshot: s, changes } = await getSiteData();
  const rows = buildRows(s, changes);
  const row = rows.find((r) => r.eip === num);

  if (!row) {
    const other = s.index.find((i) => i.eip === num);
    if (!other) notFound();
    return (
      <div className="max-w-2xl">
        <div className="num text-sm text-muted">EIP-{num}</div>
        <h1 className="display text-2xl font-extrabold">{other.title || `EIP-${num}`}</h1>
        <p className="mt-3 text-muted">
          This is not a Core EIP ({[other.type, other.category, other.status].filter(Boolean).join(" · ")}), so EIP Radar doesn&apos;t track it.
        </p>
        <p className="mt-3">
          <a href={`https://eips.ethereum.org/EIPS/eip-${num}`}>Read it on eips.ethereum.org ↗</a>
        </p>
      </div>
    );
  }

  const byNum = new Map(rows.map((r) => [r.eip, r]));
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
      <EipSummary row={row} headingLevel={1} />
      <aside>
        <Section id="graph" title="Requires / required by">
          <RequiresGraph row={row} byNum={byNum} index={new Map(s.index.map((i) => [i.eip, i.title]))} />
        </Section>
      </aside>
    </div>
  );
}

function Node({ n, row, title }: { n: number; row?: EipRow; title?: string }) {
  return (
    <Link
      href={`/eips/${n}`}
      className="block rounded border border-line bg-surface px-2 py-1 text-xs no-underline hover:border-line-strong"
      style={{ borderLeft: `3px solid ${row ? trackColor(row.track) : "var(--line-strong)"}` }}
      title={row ? `${row.title} (${row.status})` : title}
    >
      <span className="num font-semibold">{n}</span>{" "}
      {row ? (
        <span aria-hidden className="inline-block h-2 w-2 rounded-[2px] align-middle" style={{ backgroundColor: statusColor(row.status) }} />
      ) : null}
      <span className="line-clamp-1 text-muted">{row?.title ?? title ?? "not Core"}</span>
    </Link>
  );
}

function RequiresGraph({ row, byNum, index }: { row: EipRow; byNum: Map<number, EipRow>; index: Map<number, string> }) {
  return (
    <figure className="m-0">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <ul className="space-y-1" aria-label="Requires">
          {row.requires.length ? (
            row.requires.map((n) => (
              <li key={n}>
                <Node n={n} row={byNum.get(n)} title={index.get(n)} />
              </li>
            ))
          ) : (
            <li className="text-xs text-muted">none</li>
          )}
        </ul>
        <div className="flex flex-col items-center text-xs text-muted">
          <span aria-hidden>→</span>
          <span className="num my-1 rounded bg-fg px-1.5 py-0.5 font-semibold text-bg">{row.eip}</span>
          <span aria-hidden>→</span>
        </div>
        <ul className="space-y-1" aria-label="Required by">
          {row.requiredBy.length ? (
            row.requiredBy.map((n) => (
              <li key={n}>
                <Node n={n} row={byNum.get(n)} />
              </li>
            ))
          ) : (
            <li className="text-xs text-muted">none</li>
          )}
        </ul>
      </div>
      <figcaption className="mt-2 text-xs text-muted">
        Left: EIPs this one requires. Right: Core EIPs that require it. Border colour is the track; square is the status.
      </figcaption>
    </figure>
  );
}

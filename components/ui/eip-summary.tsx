// Shared EIP detail body: used by the explorer drawer (client) and /eips/[n] (server).
// Keep it free of hooks and server-only imports.

import Link from "next/link";
import { statusColor } from "@/lib/colors";
import { fmtDate } from "@/lib/format";
import type { EipRow } from "@/lib/rows";
import { EipNumber, StagePill, StatusPill, TrackPill } from "./pills";

export function EipSummary({ row, headingLevel = 2 }: { row: EipRow; headingLevel?: 1 | 2 }) {
  const H = headingLevel === 1 ? "h1" : "h2";
  return (
    <article className="min-w-0">
      <div className="num text-sm text-muted">EIP-{row.eip}</div>
      <H className="display mt-0.5 text-2xl font-extrabold leading-tight sm:text-3xl">{row.title}</H>
      {row.description ? <p className="mt-2 text-muted">{row.description}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <StatusPill status={row.status} />
        <TrackPill track={row.track} link />
        {row.trackSource === "rule" ? <span className="text-xs text-muted">(track auto-classified)</span> : null}
      </div>

      <StatusHistory row={row} />

      {row.abstract ? (
        <section className="mt-6">
          <h3 className="eyebrow mb-1">Abstract</h3>
          <p className="max-w-prose text-[15px]">{row.abstract}</p>
        </section>
      ) : null}

      <dl className="mt-6 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted">Created</dt>
        <dd className="num">{fmtDate(row.created)}</dd>
        {row.lastCallDeadline ? (
          <>
            <dt className="text-muted">Last Call ends</dt>
            <dd className="num">{fmtDate(row.lastCallDeadline)}</dd>
          </>
        ) : null}
        {row.withdrawalReason ? (
          <>
            <dt className="text-muted">Withdrawn because</dt>
            <dd>{row.withdrawalReason}</dd>
          </>
        ) : null}
        <dt className="text-muted">Authors</dt>
        <dd>{row.authors.join(", ") || "—"}</dd>
        <dt className="text-muted">Upgrades</dt>
        <dd>
          {row.memberships.length ? (
            <ul className="flex flex-col gap-1">
              {row.memberships.map((m) => (
                <li key={m.upgrade} className="flex flex-wrap items-center gap-2">
                  <Link href={`/upgrades/${m.upgrade}`}>{m.name}</Link>
                  <StagePill stage={m.stage} shipped={m.status === "shipped"} />
                </li>
              ))}
            </ul>
          ) : (
            "Not listed in any upgrade"
          )}
        </dd>
        <dt className="text-muted">Requires</dt>
        <dd className="flex flex-wrap gap-x-3">{row.requires.length ? row.requires.map((n) => <EipNumber key={n} n={n} />) : "—"}</dd>
        <dt className="text-muted">Required by</dt>
        <dd className="flex flex-wrap gap-x-3">{row.requiredBy.length ? row.requiredBy.map((n) => <EipNumber key={n} n={n} />) : "—"}</dd>
      </dl>

      <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <li>
          <a href={`https://eips.ethereum.org/EIPS/eip-${row.eip}`}>Specification ↗</a>
        </li>
        {row.discussionsTo ? (
          <li>
            <a href={row.discussionsTo}>Discussion thread ↗</a>
          </li>
        ) : null}
        <li>
          <a href={`https://github.com/ethereum/EIPs/blob/master/EIPS/eip-${row.eip}.md`}>Source on GitHub ↗</a>
        </li>
        <li>
          <a href={`https://github.com/ethereum/EIPs/commits/master/EIPS/eip-${row.eip}.md`}>File history ↗</a>
        </li>
      </ul>
    </article>
  );
}

export function StatusHistory({ row }: { row: EipRow }) {
  return (
    <section className="mt-5" aria-label="Status history">
      <h3 className="eyebrow mb-1.5">Status history</h3>
      <ol className="flex flex-wrap items-center gap-y-2 text-xs">
        {row.history.map((h, i) => (
          <li key={i} className="flex items-center">
            {i > 0 ? (
              <span aria-hidden className="px-1.5 text-faint">
                {h.source === "observed" && !h.since ? "⋯" : "→"}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5 rounded border border-line bg-surface px-1.5 py-0.5">
              <span
                aria-hidden
                className={`inline-block h-2 w-2 rounded-[2px] ${h.status === "Withdrawn" ? "hatch" : ""}`}
                style={{ backgroundColor: statusColor(h.status) }}
              />
              {h.status}
              <span className="num text-muted">{h.since ? fmtDate(h.since) : "date not observed"}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

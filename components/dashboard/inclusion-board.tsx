import Link from "next/link";
import { TRACK_LABEL, statusColor, trackColor } from "@/lib/colors";
import type { UpgradeMember } from "@/lib/derive";
import { TRACKS, type Stage } from "@/lib/types";

const COLUMNS: { stage: Stage; hint: string }[] = [
  { stage: "Scheduled", hint: "Committed to the fork" },
  { stage: "Considered", hint: "Client teams evaluating" },
  { stage: "Proposed", hint: "Champions asked for inclusion" },
  { stage: "Declined", hint: "Not in this fork" },
];

/**
 * Kanban view of an upgrade's EIP-7723 inclusion stages. Each card is a Core EIP; the left bar is
 * its track and the square its status, both also spelled out for screen readers and in the title.
 */
export function InclusionBoard({ members, upgradeName }: { members: UpgradeMember[]; upgradeName: string }) {
  const total = members.length;
  return (
    <figure className="m-0">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="inclusion-board">
        {COLUMNS.map(({ stage, hint }) => {
          const list = members
            .filter((m) => m.stage === stage)
            .sort((a, b) => TRACKS.indexOf(a.track) - TRACKS.indexOf(b.track) || a.eip - b.eip);
          return (
            <section key={stage} aria-label={`${stage}: ${list.length}`} className={`rounded border border-line p-2 ${stage === "Declined" ? "bg-bg" : "bg-surface"}`}>
              <header className="mb-2 flex items-baseline justify-between px-1">
                <h3 className={`font-mono text-[11px] uppercase tracking-wide ${stage === "Scheduled" ? "font-semibold text-fg" : "text-muted"}`}>{stage}</h3>
                <span className="num text-sm font-semibold">{list.length}</span>
              </header>
              <p className="mb-2 px-1 text-[11px] text-muted">{hint}</p>
              {list.length ? (
                <ul className={`flex flex-col gap-1 ${stage === "Declined" ? "opacity-70" : ""}`}>
                  {list.map((m) => (
                    <li key={m.eip}>
                      <Link
                        href={`/eips/${m.eip}`}
                        title={`EIP-${m.eip}: ${m.title} — ${TRACK_LABEL[m.track]}, ${m.status}`}
                        className="flex items-stretch overflow-hidden rounded-sm border border-line bg-surface text-xs no-underline hover:border-line-strong"
                      >
                        <span aria-hidden className="w-1 shrink-0" style={{ backgroundColor: trackColor(m.track) }} />
                        <span className="flex min-w-0 flex-1 items-center gap-1.5 px-1.5 py-1">
                          <span className="num shrink-0 font-semibold">{m.eip}</span>
                          <span className={`min-w-0 truncate ${stage === "Declined" ? "line-through decoration-1" : ""}`}>{m.title}</span>
                          <span aria-hidden className="ml-auto h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: statusColor(m.status) }} />
                          <span className="sr-only">
                            , {TRACK_LABEL[m.track]}, {m.status}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-1 text-xs text-muted">None</p>
              )}
            </section>
          );
        })}
      </div>
      <figcaption className="mt-2 text-sm text-muted">
        {total} Core EIPs listed for {upgradeName}. Stages follow EIP-7723. Bar colour is the track; the square is the EIP&apos;s own status.
      </figcaption>
    </figure>
  );
}

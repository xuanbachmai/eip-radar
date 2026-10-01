import Link from "next/link";
import { TRACK_LABEL, trackColor } from "@/lib/colors";
import { fmtDate } from "@/lib/format";
import type { CoreEip } from "@/lib/types";

/** EIPs in Last Call, soonest deadline first — the ones about to become Final. */
export function LastCallWatch({ eips, now }: { eips: CoreEip[]; now: number }) {
  // Upcoming deadlines first (soonest on top), then ones whose deadline passed without a move to Final.
  const today = new Date(now).toISOString().slice(0, 10);
  const list = eips
    .filter((e) => e.status === "Last Call")
    .sort((a, b) => {
      const [da, db] = [a.lastCallDeadline ?? "9", b.lastCallDeadline ?? "9"];
      const [pa, pb] = [da < today, db < today];
      return pa === pb ? (pa ? db.localeCompare(da) : da.localeCompare(db)) : pa ? 1 : -1;
    });
  if (!list.length) return <p className="text-sm text-muted">No Core EIPs are in Last Call.</p>;
  return (
    <ul className="divide-y divide-line/70 border-y border-line/70" data-testid="last-call">
      {list.map((e) => {
        const due = e.lastCallDeadline ? Date.parse(`${e.lastCallDeadline}T00:00:00Z`) : NaN;
        const days = Number.isFinite(due) ? Math.ceil((due - now) / 86_400_000) : null;
        return (
          <li key={e.eip} className="flex items-baseline gap-2 py-1.5 text-sm">
            <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: trackColor(e.track) }} />
            <Link href={`/eips/${e.eip}`} className="num shrink-0 font-semibold no-underline hover:underline">
              EIP-{e.eip}
            </Link>
            <span className="min-w-0 flex-1 truncate" title={`${e.title} — ${TRACK_LABEL[e.track]}`}>
              {e.title}
            </span>
            <span className="num shrink-0 text-xs text-muted">
              {days === null ? "no deadline" : days > 0 ? `${days} d left · ${fmtDate(due)}` : <span className="text-[var(--warn-fg)]">overdue since {fmtDate(due)}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

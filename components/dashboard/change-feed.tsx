import Link from "next/link";
import { describeEvent } from "@/lib/events";
import { fmtDate, isoDay } from "@/lib/format";
import type { ChangeEvent, Upgrade } from "@/lib/types";
import { SinceLastVisit } from "./since-last-visit";

export function ChangeFeed({ events, upgrades, limit = 20 }: { events: ChangeEvent[]; upgrades: Upgrade[]; limit?: number }) {
  const names = new Map(upgrades.map((u) => [u.slug, u.name]));
  const name = (s: string) => names.get(s) ?? s;
  const recent = [...events].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  const byDay = new Map<string, ChangeEvent[]>();
  for (const e of recent) byDay.set(isoDay(e.at), [...(byDay.get(isoDay(e.at)) ?? []), e]);

  return (
    <div data-testid="change-feed">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <SinceLastVisit times={events.map((e) => e.at)} />
        <a href="/feed.xml" className="text-sm text-muted">
          RSS
        </a>
      </div>
      {recent.length === 0 ? (
        <p className="text-sm text-muted">No changes observed yet. Changes are recorded from every sync onward.</p>
      ) : (
        <ol className="space-y-4">
          {[...byDay].map(([day, list]) => (
            <li key={day}>
              <h3 className="eyebrow mb-1">
                <time dateTime={day}>{fmtDate(day)}</time>
              </h3>
              <ul className="divide-y divide-line/70 border-y border-line/70">
                {list.map((e, i) => {
                  const d = describeEvent(e, name);
                  return (
                    <li key={i} className="flex flex-wrap items-baseline gap-x-2 py-1.5 text-sm">
                      {d.eip ? (
                        <Link href={`/eips/${d.eip}`} className="num shrink-0 font-semibold no-underline hover:underline">
                          EIP-{d.eip}
                        </Link>
                      ) : null}
                      <span className="min-w-0 truncate">{d.subject}</span>
                      <span className="text-muted">· {d.text}</span>
                      <a href={`https://github.com/ethereum/EIPs/commit/${e.commit}`} className="num ml-auto text-xs text-muted" aria-label="Commit">
                        {e.commit.slice(0, 7)}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

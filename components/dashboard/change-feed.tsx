import Link from "next/link";
import { statusColor, trackColor } from "@/lib/colors";
import { describeEvent, describeGroup, groupEvents, type EventGroup } from "@/lib/events";
import { fmtDate, isoDay } from "@/lib/format";
import type { ChangeEvent, Upgrade } from "@/lib/types";
import { SinceLastVisit } from "./since-last-visit";

const KIND: Record<ChangeEvent["type"], string> = {
  status_change: "Status",
  new_eip: "New",
  fork_inclusion_change: "Inclusion",
  activation_scheduled: "Date",
  blob_params_set: "Blobs",
};

export function ChangeFeed({ events, upgrades, limit = 14 }: { events: ChangeEvent[]; upgrades: Upgrade[]; limit?: number }) {
  const names = new Map(upgrades.map((u) => [u.slug, u.name]));
  const name = (s: string) => names.get(s) ?? s;
  const groups = groupEvents(events).slice(0, limit);
  const byDay = new Map<string, EventGroup[]>();
  for (const g of groups) byDay.set(isoDay(g.at), [...(byDay.get(isoDay(g.at)) ?? []), g]);

  return (
    <div data-testid="change-feed">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <SinceLastVisit times={events.map((e) => e.at)} />
        <a href="/feed.xml" className="text-sm text-muted">
          RSS
        </a>
        <a href="/api/changes" className="text-sm text-muted">
          JSON
        </a>
      </div>
      {groups.length === 0 ? (
        <p className="text-sm text-muted">No changes observed yet. Changes are recorded from every sync onward.</p>
      ) : (
        <ol className="space-y-4">
          {[...byDay].map(([day, list]) => (
            <li key={day}>
              <h3 className="eyebrow mb-1">
                <time dateTime={day}>{fmtDate(day)}</time>
              </h3>
              <ul className="divide-y divide-line/70 border-y border-line/70">
                {list.map((g) => (
                  <li key={g.key} className="py-1.5 text-sm">
                    {g.events.length === 1 ? <Single e={g.events[0]!} name={name} /> : <Group g={g} name={name} />}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Kind({ type }: { type: ChangeEvent["type"] }) {
  return <span className="w-[62px] shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted">{KIND[type]}</span>;
}

function Commit({ sha }: { sha: string }) {
  return (
    <a href={`https://github.com/ethereum/EIPs/commit/${sha}`} className="num ml-auto shrink-0 pl-2 text-[11px] text-muted" aria-label={`Commit ${sha.slice(0, 7)}`}>
      {sha.slice(0, 7)}
    </a>
  );
}

function Single({ e, name }: { e: ChangeEvent; name: (s: string) => string }) {
  const d = describeEvent(e, name);
  const track = "track" in e ? e.track : undefined;
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <Kind type={e.type} />
      <div className="min-w-0 flex-1">
        {d.eip ? (
          <Link href={`/eips/${d.eip}`} className="num mr-1.5 font-semibold no-underline hover:underline">
            {track ? <span aria-hidden className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: trackColor(track) }} /> : null}
            EIP-{d.eip}
          </Link>
        ) : null}
        <span className="break-words">{d.subject}</span> <span className="text-muted">· {d.text}</span>
      </div>
      <Commit sha={e.commit} />
    </div>
  );
}

function Group({ g, name }: { g: EventGroup; name: (s: string) => string }) {
  const first = g.events[0]!;
  return (
    <details className="group">
      <summary className="flex min-w-0 cursor-pointer list-none items-baseline gap-2 [&::-webkit-details-marker]:hidden">
        <Kind type={first.type} />
        <span className="min-w-0 flex-1">
          {describeGroup(g, name)}
          <span className="ml-1.5 text-xs text-muted group-open:hidden">show ▾</span>
          <span className="ml-1.5 hidden text-xs text-muted group-open:inline">hide ▴</span>
        </span>
        <Commit sha={g.commit} />
      </summary>
      <ul className="mt-1.5 mb-1 ml-[70px] flex flex-wrap gap-1">
        {g.events.map((e, i) =>
          "eip" in e ? (
            <li key={i}>
              <Link
                href={`/eips/${e.eip}`}
                title={e.title}
                className="inline-flex items-center gap-1 rounded border border-line bg-surface px-1.5 py-0.5 text-xs no-underline hover:border-line-strong"
              >
                {"track" in e && e.track ? <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: trackColor(e.track) }} /> : null}
                {e.type === "status_change" ? <span aria-hidden className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: statusColor(e.to) }} /> : null}
                <span className="num">{e.eip}</span>
                <span className="max-w-[180px] truncate text-muted">{e.title}</span>
              </Link>
            </li>
          ) : null,
        )}
      </ul>
    </details>
  );
}

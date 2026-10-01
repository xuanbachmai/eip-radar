"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { WatchButton } from "@/components/ui/watch-button";
import { statusColor, trackColor } from "@/lib/colors";
import { useSearchIndex, useWatchlist } from "@/lib/client-store";
import { describeEvent } from "@/lib/events";
import { fmtDate } from "@/lib/format";
import type { ChangeEvent, Track } from "@/lib/types";

/** The viewer's starred EIPs (stored in this browser only) with their latest recorded change. */
export function WatchlistPanel({ upgradeNames }: { upgradeNames: Record<string, string> }) {
  const { list } = useWatchlist();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const index = useSearchIndex(mounted && list.length > 0);
  const [events, setEvents] = useState<ChangeEvent[] | null>(null);

  useEffect(() => {
    if (!mounted || !list.length) return;
    let live = true;
    fetch("/api/changes?limit=2000")
      .then((r) => r.json() as Promise<{ events: ChangeEvent[] }>)
      .then((d) => live && setEvents(d.events))
      .catch(() => live && setEvents([]));
    return () => {
      live = false;
    };
  }, [mounted, list.length]);

  const rows = useMemo(() => {
    if (!index) return [];
    const byEip = new Map(index.eips.map((e) => [e[0], e]));
    return list.map((n) => {
      const e = byEip.get(n);
      const last = events?.find((ev) => "eip" in ev && ev.eip === n);
      return { n, title: e?.[1] ?? "Not a Core EIP", status: e?.[2], track: e?.[3] as Track | undefined, last };
    });
  }, [index, list, events]);

  if (!mounted) return <div className="h-16" />;
  if (!list.length) {
    return (
      <p className="text-sm text-muted" data-testid="watchlist-empty">
        Star EIPs in the <Link href="/eips">explorer</Link> or on any EIP page to follow them here. Your list stays in this browser.
      </p>
    );
  }
  const name = (s: string) => upgradeNames[s] ?? s;
  return (
    <ul className="divide-y divide-line/70 border-y border-line/70" data-testid="watchlist">
      {(rows.length ? rows : list.map((n) => ({ n, title: "…", status: undefined, track: undefined, last: undefined }))).map((r) => (
        <li key={r.n} className="flex items-center gap-2 py-1 text-sm">
          {r.track ? <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: trackColor(r.track) }} /> : null}
          <Link href={`/eips/${r.n}`} className="num shrink-0 font-semibold no-underline hover:underline">
            EIP-{r.n}
          </Link>
          <span className="min-w-0 flex-1 truncate">
            {r.title}
            {r.last ? (
              <span className="ml-1.5 text-xs text-muted">
                · {describeEvent(r.last, name).text}, {fmtDate(r.last.at)}
              </span>
            ) : null}
          </span>
          {r.status ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted">
              <span aria-hidden className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: statusColor(r.status) }} />
              {r.status}
            </span>
          ) : null}
          <WatchButton eip={r.n} compact />
        </li>
      ))}
    </ul>
  );
}

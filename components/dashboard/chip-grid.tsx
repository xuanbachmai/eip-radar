"use client";

import Link from "next/link";
import { TRACK_LABEL, statusColor, trackColor } from "@/lib/colors";
import type { Track } from "@/lib/types";
import { useHighlight } from "@/components/viz/frame";

export interface GridChip {
  eip: number;
  title: string;
  track: Track;
  status: string;
}

/** Track-coloured EIP tiles; hovering one highlights the same EIP in the timeline. */
export function ChipGrid({ chips }: { chips: GridChip[] }) {
  const { eip: hi, set } = useHighlight();
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-1.5" data-testid="hero-grid">
      {chips.map((c) => (
        <li key={c.eip}>
          <Link
            href={`/eips/${c.eip}`}
            onMouseEnter={() => set(c.eip)}
            onMouseLeave={() => set(null)}
            onFocus={() => set(c.eip)}
            onBlur={() => set(null)}
            title={`EIP-${c.eip}: ${c.title} — ${TRACK_LABEL[c.track]}, ${c.status}`}
            className={`flex h-full items-stretch overflow-hidden rounded border bg-bg no-underline transition-colors ${
              hi === c.eip ? "border-fg" : "border-line hover:border-line-strong"
            }`}
          >
            <span aria-hidden className="w-1 shrink-0" style={{ backgroundColor: trackColor(c.track) }} />
            <span className="flex min-w-0 flex-1 flex-col px-2 py-1.5">
              <span className="flex items-center gap-1.5 text-[11px]">
                <span className="num font-semibold">{c.eip}</span>
                <span className="text-muted">{TRACK_LABEL[c.track]}</span>
                <span className="ml-auto inline-flex items-center gap-1 text-muted">
                  <span aria-hidden className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: statusColor(c.status) }} />
                  {c.status}
                </span>
              </span>
              <span className="mt-0.5 line-clamp-2 text-xs leading-snug">{c.title}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

"use client";

import Link from "next/link";
import { TRACK_GLYPH, TRACK_LABEL, trackColor } from "@/lib/colors";
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
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1.5" data-testid="hero-grid">
      {chips.map((c) => (
        <li key={c.eip}>
          <Link
            href={`/eips/${c.eip}`}
            onMouseEnter={() => set(c.eip)}
            onMouseLeave={() => set(null)}
            onFocus={() => set(c.eip)}
            onBlur={() => set(null)}
            title={`EIP-${c.eip}: ${c.title} — ${TRACK_LABEL[c.track]}, ${c.status}`}
            className={`flex h-full items-stretch overflow-hidden rounded border bg-surface no-underline transition-colors ${
              hi === c.eip ? "border-fg" : "border-line hover:border-line-strong"
            }`}
          >
            <span className="flex w-5 shrink-0 items-center justify-center text-[10px] font-semibold text-black/75" style={{ backgroundColor: trackColor(c.track) }} aria-hidden>
              {TRACK_GLYPH[c.track]}
            </span>
            <span className="min-w-0 px-2 py-1.5">
              <span className="num block text-xs font-semibold">
                {c.eip} <span className="font-normal text-muted">· {c.status}</span>
              </span>
              <span className="line-clamp-2 block text-xs leading-snug">{c.title}</span>
              <span className="sr-only">, {TRACK_LABEL[c.track]} track</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

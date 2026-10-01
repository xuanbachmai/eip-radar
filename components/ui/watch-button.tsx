"use client";

import { useEffect, useState } from "react";
import { useWatchlist } from "@/lib/client-store";

/** Star toggle. Renders a neutral placeholder until hydrated so server HTML matches. */
export function WatchButton({ eip, compact = false }: { eip: number; compact?: boolean }) {
  const { has, toggle } = useWatchlist();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const on = ready && has(eip);
  const label = on ? `Stop watching EIP-${eip}` : `Watch EIP-${eip}`;
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        toggle(eip);
      }}
      onKeyDown={(e) => e.stopPropagation()}
      data-testid="watch-button"
      className={`inline-flex shrink-0 items-center gap-1 rounded border text-xs ${
        compact ? "h-7 w-7 justify-center border-transparent" : "border-line px-2 py-1 hover:border-line-strong"
      } ${on ? "text-[var(--track-verge)]" : "text-muted hover:text-fg"}`}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
        <path
          d="M8 1.5l1.9 4.1 4.4.5-3.3 3 .9 4.4L8 11.3l-3.9 2.2.9-4.4-3.3-3 4.4-.5z"
          fill={on ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
      {compact ? null : on ? "Watching" : "Watch"}
    </button>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { statusColor, trackColor } from "@/lib/colors";
import { useSearchIndex } from "@/lib/client-store";
import { search, type Hit } from "@/lib/search";
import type { Track } from "@/lib/types";

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const index = useSearchIndex(open);
  const hits = useMemo(() => search(index, q), [index, q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => setActive(0), [q]);

  const go = (h: Hit | undefined) => {
    if (!h) return;
    setOpen(false);
    setQ("");
    router.push(h.href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-2 rounded border border-line px-2 text-sm text-muted hover:border-line-strong hover:text-fg"
        aria-label="Search EIPs, upgrades and tracks"
        data-testid="palette-open"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
          <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded border border-line px-1 font-mono text-[10px] sm:inline">⌘K</kbd>
      </button>
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === dialog.current && setOpen(false)}
        aria-label="Quick search"
        className="mx-auto mt-[12vh] w-[min(640px,calc(100vw-32px))] rounded-md border border-line-strong bg-surface p-0 text-fg shadow-2xl"
      >
        {open ? (
          <div>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, hits.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  go(hits[active]);
                }
              }}
              placeholder="EIP number, title, upgrade or track…"
              role="combobox"
              aria-expanded="true"
              aria-controls="palette-results"
              aria-activedescendant={hits[active] ? `palette-${active}` : undefined}
              className="w-full border-b border-line bg-transparent px-4 py-3 text-base outline-none"
              data-testid="palette-input"
            />
            <ul id="palette-results" role="listbox" className="max-h-[50vh] overflow-y-auto py-1">
              {!index && q ? <li className="px-4 py-2 text-sm text-muted">Loading index…</li> : null}
              {index && hits.length === 0 ? <li className="px-4 py-2 text-sm text-muted">No matches.</li> : null}
              {hits.map((h, i) => (
                <li
                  key={h.href}
                  id={`palette-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(h)}
                  className={`flex cursor-pointer items-center gap-3 px-4 py-2 text-sm ${i === active ? "bg-surface-2" : ""}`}
                >
                  <span className="w-16 shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted">{h.kind}</span>
                  {h.track ? <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: trackColor(h.track as Track) }} /> : null}
                  <span className="num shrink-0 font-semibold">{h.label}</span>
                  {h.detail ? <span className="min-w-0 truncate">{h.detail}</span> : null}
                  {h.status ? (
                    <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs text-muted">
                      <span aria-hidden className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: statusColor(h.status) }} />
                      {h.status}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="flex gap-4 border-t border-line px-4 py-2 font-mono text-[10px] text-muted">
              <span>↑↓ move</span>
              <span>↵ open</span>
              <span>esc close</span>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}

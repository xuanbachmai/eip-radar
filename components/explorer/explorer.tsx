"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { EipSummary } from "@/components/ui/eip-summary";
import { StagePill, StatusPill, TrackPill } from "@/components/ui/pills";
import { TRACK_LABEL } from "@/lib/colors";
import { useWatchlist } from "@/lib/client-store";
import { toCsv } from "@/lib/format";
import { WatchButton } from "@/components/ui/watch-button";
import type { EipRow } from "@/lib/rows";
import { TRACKS, type Track } from "@/lib/types";

const STATUSES = ["Final", "Last Call", "Review", "Draft", "Stagnant", "Withdrawn"];
const STAGES = ["Scheduled", "Considered", "Proposed", "Declined"];
const ROW_H = 44;
const OVERSCAN = 8;

type SortKey = "eip" | "title" | "status" | "track" | "upgrade" | "created";
const COLUMNS: { key: SortKey; label: string; className: string }[] = [
  { key: "eip", label: "EIP", className: "w-[72px] shrink-0" },
  { key: "title", label: "Title", className: "min-w-0 flex-1" },
  { key: "status", label: "Status", className: "w-[104px] shrink-0" },
  { key: "track", label: "Track", className: "hidden w-[104px] shrink-0 sm:block" },
  { key: "upgrade", label: "Upgrade", className: "hidden w-[190px] shrink-0 md:block" },
  { key: "created", label: "Created", className: "hidden w-[92px] shrink-0 lg:block" },
];

const STATUS_RANK = Object.fromEntries(STATUSES.map((s, i) => [s, i]));

interface Filters {
  q: string;
  status: string[];
  track: string[];
  upgrade: string;
  stage: string;
  year: string;
  author: string;
  watched: boolean;
  sort: SortKey;
  dir: "asc" | "desc";
}

function readFilters(sp: URLSearchParams): Filters {
  const list = (k: string) => (sp.get(k) ?? "").split(",").filter(Boolean);
  const sort = sp.get("sort") as SortKey | null;
  return {
    q: sp.get("q") ?? "",
    status: list("status"),
    track: list("track"),
    upgrade: sp.get("upgrade") ?? "",
    stage: sp.get("stage") ?? "",
    year: sp.get("year") ?? "",
    author: sp.get("author") ?? "",
    watched: sp.get("watched") === "1",
    sort: sort && COLUMNS.some((c) => c.key === sort) ? sort : "eip",
    dir: sp.get("dir") === "asc" ? "asc" : sp.get("dir") === "desc" ? "desc" : sort ? "asc" : "desc",
  };
}

export function applyFilters(rows: EipRow[], f: Filters, watchlist: readonly number[] = []): EipRow[] {
  const terms = f.q.toLowerCase().split(/\s+/).filter(Boolean);
  const out = rows.filter((r) => {
    if (f.status.length && !f.status.includes(r.status)) return false;
    if (f.track.length && !f.track.includes(r.track)) return false;
    if (f.upgrade && !r.memberships.some((m) => m.upgrade === f.upgrade && (!f.stage || m.stage === f.stage))) return false;
    if (!f.upgrade && f.stage && !r.memberships.some((m) => m.stage === f.stage)) return false;
    if (f.year && String(r.year) !== f.year) return false;
    if (f.watched && !watchlist.includes(r.eip)) return false;
    if (f.author && !r.authors.some((a) => a.toLowerCase().includes(f.author.toLowerCase()))) return false;
    if (terms.length) {
      const hay = `${r.eip} eip-${r.eip} ${r.title} ${r.description ?? ""} ${r.abstract ?? ""} ${r.authors.join(" ")}`.toLowerCase();
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    return true;
  });
  const sign = f.dir === "asc" ? 1 : -1;
  const key = (r: EipRow): string | number => {
    switch (f.sort) {
      case "title":
        return r.title.toLowerCase();
      case "status":
        return STATUS_RANK[r.status] ?? 99;
      case "track":
        return TRACKS.indexOf(r.track);
      case "upgrade":
        return r.upgradeName ?? "~";
      case "created":
        return r.created;
      default:
        return r.eip;
    }
  };
  return out.sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    return (ka < kb ? -1 : ka > kb ? 1 : 0) * sign || a.eip - b.eip;
  });
}

export function Explorer({ rows, upgrades }: { rows: EipRow[]; upgrades: { slug: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const filters = useMemo(() => readFilters(new URLSearchParams(sp.toString())), [sp]);
  const [q, setQ] = useState(filters.q);
  const deferredQ = useDeferredValue(q);

  const update = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [sp, router, pathname],
  );

  // Debounce free-text search into the URL.
  useEffect(() => {
    if (deferredQ === filters.q) return;
    const id = setTimeout(() => update({ q: deferredQ || null }), 200);
    return () => clearTimeout(id);
  }, [deferredQ, filters.q, update]);

  const active = { ...filters, q: deferredQ };
  const { list: watchlist } = useWatchlist();
  const visible = useMemo(() => applyFilters(rows, active, watchlist), [rows, active.q, filters, watchlist]); // eslint-disable-line react-hooks/exhaustive-deps
  const [copied, setCopied] = useState(false);
  const copyLink = () => {
    navigator.clipboard
      ?.writeText(window.location.href)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  const years = useMemo(() => [...new Set(rows.map((r) => r.year))].sort((a, b) => b - a), [rows]);
  const authors = useMemo(() => [...new Set(rows.flatMap((r) => r.authors))].sort((a, b) => a.localeCompare(b)), [rows]);
  const open = Number(sp.get("eip")) || null;
  const openRow = open ? rows.find((r) => r.eip === open) : undefined;

  const toggleList = (key: "status" | "track", value: string) => {
    const cur = filters[key];
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    update({ [key]: next.join(",") || null });
  };

  const sortBy = (key: SortKey) => {
    const dir = filters.sort === key && filters.dir === "asc" ? "desc" : "asc";
    update({ sort: key, dir });
  };

  const exportCsv = () => {
    const csv = toCsv(
      visible.map((r) => ({
        eip: r.eip,
        title: r.title,
        status: r.status,
        track: r.track,
        upgrade: r.upgradeName ?? "",
        stage: r.stage ?? "",
        created: r.created,
        authors: r.authors.join("; "),
        requires: r.requires.join(" "),
        url: `https://eips.ethereum.org/EIPS/eip-${r.eip}`,
      })),
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "core-eips.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const anyFilter = filters.status.length || filters.track.length || filters.upgrade || filters.stage || filters.year || filters.author || filters.q || filters.watched;

  return (
    <div>
      <div className="flex flex-col gap-3 rounded border border-line bg-surface p-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex min-w-0 flex-1 items-center gap-2">
            <span className="sr-only">Search Core EIPs</span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search number, title, abstract, author…"
              className="w-full min-w-0 rounded border border-line bg-bg px-2 py-1.5 text-sm"
              data-testid="explorer-search"
            />
          </label>
          <span className="num text-sm text-muted" aria-live="polite" data-testid="explorer-count">
            {visible.length} of {rows.length}
          </span>
          <button type="button" onClick={copyLink} className="rounded border border-line px-2 py-1 text-sm hover:border-line-strong" aria-live="polite">
            {copied ? "Link copied" : "Copy link"}
          </button>
          <button
            type="button"
            aria-pressed={filters.watched}
            onClick={() => update({ watched: filters.watched ? null : "1" })}
            className={`rounded border px-2 py-1 text-sm ${filters.watched ? "border-fg bg-surface-2" : "border-line hover:border-line-strong"}`}
          >
            ★ Watched{watchlist.length ? ` (${watchlist.length})` : ""}
          </button>
          <button type="button" onClick={exportCsv} className="rounded border border-line px-2 py-1 text-sm hover:border-line-strong">
            Export CSV
          </button>
          {anyFilter ? (
            <button
              type="button"
              onClick={() => {
                setQ("");
                router.replace(pathname, { scroll: false });
              }}
              className="text-sm text-muted underline hover:text-fg"
            >
              Clear filters
            </button>
          ) : null}
        </div>

        <fieldset className="flex flex-wrap items-center gap-1.5">
          <legend className="eyebrow mr-2 float-left pt-1">Status</legend>
          {STATUSES.map((s) => (
            <ToggleChip key={s} pressed={filters.status.includes(s)} onClick={() => toggleList("status", s)}>
              <StatusPill status={s} />
            </ToggleChip>
          ))}
        </fieldset>
        <fieldset className="flex flex-wrap items-center gap-1.5">
          <legend className="eyebrow mr-2 float-left pt-1">Track</legend>
          {TRACKS.map((t) => (
            <ToggleChip key={t} pressed={filters.track.includes(t)} onClick={() => toggleList("track", t)}>
              <TrackPill track={t as Track} />
            </ToggleChip>
          ))}
        </fieldset>
        <div className="flex flex-wrap gap-3 text-sm">
          <Select label="Upgrade" value={filters.upgrade} onChange={(v) => update({ upgrade: v })} options={upgrades.map((u) => [u.slug, u.name])} />
          <Select label="Stage" value={filters.stage} onChange={(v) => update({ stage: v })} options={STAGES.map((s) => [s, s])} />
          <Select label="Year" value={filters.year} onChange={(v) => update({ year: v })} options={years.map((y) => [String(y), String(y)])} />
          <label className="flex items-center gap-1.5">
            <span className="text-muted">Author</span>
            <input
              list="authors"
              defaultValue={filters.author}
              onChange={(e) => update({ author: e.target.value || null })}
              className="w-40 rounded border border-line bg-bg px-2 py-1"
            />
            <datalist id="authors">
              {authors.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </label>
        </div>
      </div>

      <VirtualTable rows={visible} filters={filters} onSort={sortBy} onOpen={(n) => update({ eip: String(n) })} />

      <Drawer row={openRow} onClose={() => update({ eip: null })} />
    </div>
  );
}

function ToggleChip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`rounded border px-2 py-0.5 ${pressed ? "border-fg bg-surface-2" : "border-line hover:border-line-strong"}`}
    >
      {children}
    </button>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded border border-line bg-bg px-2 py-1">
        <option value="">Any</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function VirtualTable({ rows, filters, onSort, onOpen }: { rows: EipRow[]; filters: Filters; onSort: (k: SortKey) => void; onOpen: (n: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState(0);
  const [viewH, setViewH] = useState(640);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
  }, [filters]);

  const start = Math.max(0, Math.floor(scroll / ROW_H) - OVERSCAN);
  const end = Math.min(rows.length, Math.ceil((scroll + viewH) / ROW_H) + OVERSCAN);

  return (
    <div role="table" aria-label="Core EIPs" aria-rowcount={rows.length + 1} className="mt-4 rounded border border-line bg-surface" data-testid="explorer-table">
      <div role="rowgroup">
        <div role="row" aria-rowindex={1} className="flex items-center gap-3 border-b border-line px-3 py-2 text-xs text-muted">
          {COLUMNS.map((c) => {
            const on = filters.sort === c.key;
            return (
              <div key={c.key} role="columnheader" aria-sort={on ? (filters.dir === "asc" ? "ascending" : "descending") : "none"} className={c.className}>
                <button type="button" onClick={() => onSort(c.key)} className={`inline-flex items-center gap-1 hover:text-fg ${on ? "font-semibold text-fg" : ""}`}>
                  {c.label}
                  <span aria-hidden>{on ? (filters.dir === "asc" ? "▲" : "▼") : ""}</span>
                </button>
              </div>
            );
          })}
          <div role="columnheader" className="w-7 shrink-0">
            <span className="sr-only">Watch</span>
          </div>
        </div>
      </div>
      <div ref={ref} role="rowgroup" onScroll={(e) => setScroll(e.currentTarget.scrollTop)} className="relative h-[70vh] min-h-[360px] overflow-y-auto">
        {rows.length === 0 ? <div className="p-6 text-sm text-muted">No Core EIPs match these filters.</div> : null}
        <div style={{ height: rows.length * ROW_H }} className="relative">
          {rows.slice(start, end).map((r, i) => {
            const index = start + i;
            return (
              <div
                key={r.eip}
                role="row"
                aria-rowindex={index + 2}
                tabIndex={0}
                onClick={() => onOpen(r.eip)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen(r.eip);
                  }
                }}
                data-testid="explorer-row"
                className="absolute inset-x-0 flex cursor-pointer items-center gap-3 border-b border-line/70 px-3 text-sm hover:bg-surface-2 focus-visible:bg-surface-2"
                style={{ top: index * ROW_H, height: ROW_H }}
              >
                <div role="cell" className={`${COLUMNS[0]!.className} num`}>
                  {r.eip}
                </div>
                <div role="cell" className={`${COLUMNS[1]!.className} truncate`} title={r.title}>
                  {r.title}
                </div>
                <div role="cell" className={COLUMNS[2]!.className}>
                  <StatusPill status={r.status} />
                </div>
                <div role="cell" className={COLUMNS[3]!.className}>
                  <TrackPill track={r.track} />
                </div>
                <div role="cell" className={`${COLUMNS[4]!.className} truncate`}>
                  {r.upgradeName ? (
                    <span className="inline-flex items-center gap-1.5">
                      {r.upgradeName}
                      <StagePill stage={r.stage!} shipped={r.memberships[r.memberships.length - 1]?.status === "shipped"} />
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </div>
                <div role="cell" className={`${COLUMNS[5]!.className} num text-muted`}>
                  {r.created}
                </div>
                <div role="cell" className="w-7 shrink-0">
                  <WatchButton eip={r.eip} compact />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Drawer({ row, onClose }: { row?: EipRow; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (row && !d.open) d.showModal();
    if (!row && d.open) d.close();
  }, [row]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={row ? `EIP-${row.eip} details` : "EIP details"}
      data-testid="eip-drawer"
      className="fixed inset-y-0 right-0 left-auto m-0 h-full max-h-none w-full max-w-[560px] overflow-y-auto border-l border-line bg-bg p-0 text-fg"
    >
      {row ? (
        <div className="p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <a href={`/eips/${row.eip}`} className="text-sm">
              Open full page →
            </a>
            <button type="button" onClick={onClose} className="rounded border border-line px-2 py-0.5 text-sm hover:border-line-strong" autoFocus>
              Close
            </button>
          </div>
          <EipSummary row={row} />
          <p className="mt-6 text-xs text-muted">Track: {TRACK_LABEL[row.track]}. Press Esc to close.</p>
        </div>
      ) : null}
    </dialog>
  );
}

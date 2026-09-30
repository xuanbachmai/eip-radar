"use client";

import { scaleUtc } from "d3-scale";
import Link from "next/link";
import { TRACK_LABEL, trackColor } from "@/lib/colors";
import type { Stage, Track } from "@/lib/types";
import { DataTable, Figure, Legend, useHighlight, useTooltip } from "./frame";

export interface TimelineChip {
  eip: number;
  title: string;
  track: Track;
  status: string;
  stage: Stage;
}

export interface TimelineColumn {
  slug: string;
  name: string;
  kind: "legacy" | "meta" | "bpo";
  /** Mainnet activation, unix seconds. Undated columns go to the right-hand gutter. */
  ts?: number;
  state: "shipped" | "scheduled" | "planning";
  chips: TimelineChip[];
}

const DOMAIN: [Date, Date] = [new Date(Date.UTC(2015, 6, 1)), new Date(Date.UTC(2027, 11, 31))];

export function UpgradeTimeline({ columns, caption }: { columns: TimelineColumn[]; caption: string }) {
  const tracks = [...new Set(columns.flatMap((c) => c.chips.map((ch) => ch.track)))];
  const table = (
    <DataTable
      columns={["Upgrade", "Mainnet", "State", "Core EIPs", "EIPs"]}
      numeric={[3]}
      rows={columns.map((c) => [
        c.name,
        c.ts ? new Date(c.ts * 1000).toISOString().slice(0, 10) : "not set",
        c.state,
        c.chips.length,
        c.chips.map((ch) => `${ch.eip}${ch.stage === "Scheduled" ? "" : ` (${ch.stage})`}`).join(", "),
      ])}
    />
  );
  return (
    <Figure
      caption={caption}
      table={table}
      minHeight={320}
      controls={
        <Legend
          items={[
            ...(["merge", "surge", "scourge", "verge", "purge", "splurge", "legacy"] as Track[])
              .filter((t) => tracks.includes(t))
              .map((t) => ({ label: TRACK_LABEL[t], color: trackColor(t) })),
          ]}
        />
      }
    >
      {(width) => <TimelineSvg width={width} columns={columns} />}
    </Figure>
  );
}

function TimelineSvg({ width, columns }: { width: number; columns: TimelineColumn[] }) {
  const tip = useTooltip();
  const { eip: hi, set } = useHighlight();

  const dated = columns.filter((c) => c.ts !== undefined);
  const undated = columns.filter((c) => c.ts === undefined);

  const colW = Math.max(9, Math.min(22, Math.floor(width / 34)));
  const pitch = colW <= 12 ? 7 : 9; // vertical distance between chips
  const chipH = pitch - 2;
  const gutterW = undated.length ? undated.length * (colW + 4) + 16 : 0;
  const margin = { left: 4, right: 4, top: 96, bottom: 26 };
  const plotW = width - margin.left - margin.right - gutterW;

  const x = scaleUtc().domain(DOMAIN).range([colW / 2, plotW - colW / 2]);

  // Place columns at their date, then push apart so none overlap (forward), then pull back from
  // the right edge (backward). Keeps chronology while making dense 2025–26 forks legible.
  const xs = dated.map((c) => x(new Date(c.ts! * 1000)));
  const gap = colW + 3;
  for (let i = 1; i < xs.length; i++) xs[i] = Math.max(xs[i]!, xs[i - 1]! + gap);
  for (let i = xs.length - 1; i >= 0; i--) {
    const limit = i === xs.length - 1 ? plotW - colW / 2 : xs[i + 1]! - gap;
    xs[i] = Math.min(xs[i]!, limit);
  }

  const maxStack = Math.max(4, ...columns.map((c) => c.chips.length));
  const plotH = maxStack * pitch;
  const height = margin.top + plotH + margin.bottom;
  const base = margin.top + plotH;
  const now = new Date();

  const placed = [
    ...dated.map((c, i) => ({ c, cx: margin.left + xs[i]! })),
    ...undated.map((c, i) => ({ c, cx: margin.left + plotW + 16 + i * (colW + 4) + colW / 2 })),
  ];

  const years = x.ticks(width < 520 ? 6 : 12);

  return (
    <svg width={width} height={height} role="img" aria-label="Upgrade timeline, 2015 to 2027" className="block overflow-visible">
      {/* year axis */}
      <g>
        <line x1={margin.left} x2={margin.left + plotW} y1={base + 0.5} y2={base + 0.5} stroke="var(--line-strong)" />
        {years.map((y) => (
          <g key={y.getTime()} transform={`translate(${margin.left + x(y)},${base})`}>
            <line y2={4} stroke="var(--line-strong)" />
            <text y={16} textAnchor="middle" fontSize={10} fill="var(--muted)" className="num">
              {y.getUTCFullYear()}
            </text>
          </g>
        ))}
        {x(now) < plotW ? (
          <g transform={`translate(${margin.left + x(now)},0)`}>
            <line y1={margin.top - 8} y2={base} stroke="var(--fg)" strokeDasharray="2 3" opacity={0.5} />
            <text y={margin.top - 12} textAnchor="middle" fontSize={10} fill="var(--muted)">
              today
            </text>
          </g>
        ) : null}
      </g>

      {undated.length ? (
        <g>
          <rect
            x={margin.left + plotW + 8}
            y={margin.top - 4}
            width={gutterW - 8}
            height={plotH + 4}
            fill="var(--surface-2)"
            rx={3}
          />
          <text x={margin.left + plotW + 8 + (gutterW - 8) / 2} y={base + 16} textAnchor="middle" fontSize={10} fill="var(--muted)">
            not yet scheduled
          </text>
        </g>
      ) : null}

      {placed.map(({ c, cx }) => {
        const shipped = c.state === "shipped";
        const top = base - c.chips.length * pitch;
        return (
          <g key={c.slug}>
            {/* dated connector from the true date to the (possibly nudged) column */}
            {c.kind === "bpo" ? (
              <line x1={cx} x2={cx} y1={base - 18} y2={base} stroke="var(--track-surge)" strokeWidth={2} strokeDasharray={shipped ? undefined : "3 2"} />
            ) : null}
            {!shipped && c.chips.length ? (
              <rect
                x={cx - colW / 2 - 2}
                y={top - 3}
                width={colW + 4}
                height={base - top + 3}
                fill="none"
                stroke="var(--line-strong)"
                strokeDasharray="3 2"
                rx={2}
              />
            ) : null}
            <Link href={`/upgrades/${c.slug}`} aria-label={`${c.name} upgrade`}>
              <text
                transform={`translate(${cx + 3},${(c.kind === "bpo" ? base - 22 : top - 6)}) rotate(-90)`}
                fontSize={10}
                fill={shipped ? "var(--muted)" : "var(--fg)"}
                fontWeight={shipped ? 400 : 600}
              >
                {c.name}
              </text>
            </Link>
            {c.chips.map((ch, i) => {
              const y = base - (i + 1) * pitch + 1;
              const active = hi === ch.eip;
              const outline = ch.stage !== "Scheduled";
              return (
                <a
                  key={ch.eip}
                  href={`/eips/${ch.eip}`}
                  aria-label={`EIP-${ch.eip} ${ch.title}, ${TRACK_LABEL[ch.track]}, ${ch.status}${outline ? `, ${ch.stage}` : ""}`}
                  onMouseEnter={(e) => {
                    set(ch.eip);
                    tip.show(<ChipTip chip={ch} upgrade={c.name} />, e.currentTarget);
                  }}
                  onMouseLeave={() => {
                    set(null);
                    tip.hide();
                  }}
                  onFocus={(e) => {
                    set(ch.eip);
                    tip.show(<ChipTip chip={ch} upgrade={c.name} />, e.currentTarget);
                  }}
                  onBlur={() => {
                    set(null);
                    tip.hide();
                  }}
                >
                  <rect
                    className="mark"
                    x={cx - colW / 2}
                    y={y}
                    width={colW}
                    height={chipH}
                    rx={1.5}
                    fill={outline ? "var(--surface)" : trackColor(ch.track)}
                    fillOpacity={shipped || outline ? 1 : 0.85}
                    stroke={active ? "var(--fg)" : outline ? trackColor(ch.track) : "none"}
                    strokeWidth={active ? 2 : 1.25}
                    strokeDasharray={outline && !active ? "2 1.5" : undefined}
                  />
                </a>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

function ChipTip({ chip, upgrade }: { chip: TimelineChip; upgrade: string }) {
  return (
    <div>
      <div className="num font-semibold">EIP-{chip.eip}</div>
      <div>{chip.title}</div>
      <div className="mt-1 text-muted">
        {TRACK_LABEL[chip.track]} · {chip.status} · {upgrade}
        {chip.stage !== "Scheduled" ? ` (${chip.stage})` : ""}
      </div>
    </div>
  );
}

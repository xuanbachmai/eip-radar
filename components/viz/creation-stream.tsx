"use client";

import { scaleBand, scaleLinear } from "d3-scale";
import { useState } from "react";
import { TRACK_LABEL, trackColor } from "@/lib/colors";
import type { YearTrackCount } from "@/lib/derive";
import { TRACKS } from "@/lib/types";
import { DataTable, Figure, Legend, useTooltip } from "./frame";

export function CreationStream({
  all,
  survivors,
  currentYear,
}: {
  all: YearTrackCount[];
  survivors: YearTrackCount[];
  currentYear: number;
}) {
  const [mode, setMode] = useState<"all" | "survivors">("all");
  const data = mode === "all" ? all : survivors;
  const peak = [...all].sort((a, b) => b.total - a.total)[0];
  const caption = `Core EIPs created per year, by track${peak ? `; the peak was ${peak.year} with ${peak.total}` : ""}. ${currentYear} is partial.${
    mode === "survivors" ? " Showing only proposals not Stagnant or Withdrawn." : ""
  }`;

  const table = (
    <DataTable
      columns={["Year", ...TRACKS.map((t) => TRACK_LABEL[t]), "Total"]}
      numeric={TRACKS.map((_, i) => i + 1).concat(TRACKS.length + 1)}
      rows={data.map((r) => [r.year === currentYear ? `${r.year} (partial)` : r.year, ...TRACKS.map((t) => r.counts[t]), r.total])}
    />
  );

  return (
    <Figure
      caption={caption}
      table={table}
      minHeight={260}
      controls={
        <>
          <div role="radiogroup" aria-label="Which proposals" className="inline-flex overflow-hidden rounded border border-line">
            {(["all", "survivors"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={`px-2 py-0.5 text-xs ${mode === m ? "bg-fg text-bg" : "text-muted hover:text-fg"}`}
              >
                {m === "all" ? "All proposals" : "Survivors only"}
              </button>
            ))}
          </div>
          <Legend items={TRACKS.map((t) => ({ label: TRACK_LABEL[t], color: trackColor(t) }))} />
        </>
      }
    >
      {(width) => <StreamSvg width={width} data={data} max={Math.max(...all.map((r) => r.total))} currentYear={currentYear} />}
    </Figure>
  );
}

function StreamSvg({ width, data, max, currentYear }: { width: number; data: YearTrackCount[]; max: number; currentYear: number }) {
  const tip = useTooltip();
  const m = { top: 8, right: 4, bottom: 22, left: 28 };
  const height = 240;
  const x = scaleBand<number>()
    .domain(data.map((d) => d.year))
    .range([m.left, width - m.right])
    .padding(0.18);
  const y = scaleLinear().domain([0, max]).nice().range([height - m.bottom, m.top]);
  const every = width < 480 ? 3 : width < 800 ? 2 : 1;

  return (
    <svg width={width} height={height} role="img" aria-label="Core EIPs created per year by track" className="block">
      <defs>
        <pattern id="partial-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="4" stroke="var(--surface)" strokeWidth="1.5" opacity="0.7" />
        </pattern>
      </defs>
      {y.ticks(4).map((t) => (
        <g key={t}>
          <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke="var(--line)" />
          <text x={m.left - 6} y={y(t)} dominantBaseline="middle" textAnchor="end" fontSize={10} fill="var(--muted)" className="num">
            {t}
          </text>
        </g>
      ))}
      {data.map((d, i) => {
        let acc = 0;
        const bx = x(d.year)!;
        const partial = d.year === currentYear;
        const label = `${d.year}${partial ? " (partial)" : ""}: ${d.total} created — ${TRACKS.filter((t) => d.counts[t])
          .map((t) => `${TRACK_LABEL[t]} ${d.counts[t]}`)
          .join(", ")}`;
        return (
          <g
            key={d.year}
            tabIndex={0}
            aria-label={label}
            onMouseEnter={(e) => tip.show(label, e.currentTarget)}
            onMouseLeave={tip.hide}
            onFocus={(e) => tip.show(label, e.currentTarget)}
            onBlur={tip.hide}
          >
            <rect x={bx - 1} y={m.top} width={x.bandwidth() + 2} height={height - m.bottom - m.top} fill="transparent" />
            {TRACKS.map((t) => {
              const n = d.counts[t];
              if (!n) return null;
              const y0 = y(acc);
              acc += n;
              const y1 = y(acc);
              return <rect key={t} className="mark" x={bx} y={y1} width={x.bandwidth()} height={Math.max(0, y0 - y1 - 0.5)} fill={trackColor(t)} />;
            })}
            {partial ? (
              <>
                <rect x={bx} y={y(d.total)} width={x.bandwidth()} height={y(0) - y(d.total)} fill="url(#partial-hatch)" />
                <text x={bx + x.bandwidth() / 2} y={y(d.total) - 4} textAnchor="middle" fontSize={9} fill="var(--muted)">
                  partial
                </text>
              </>
            ) : null}
            {i % every === 0 || partial ? (
              <text x={bx + x.bandwidth() / 2} y={height - 6} textAnchor="middle" fontSize={10} fill="var(--muted)" className="num">
                {every > 1 ? `’${String(d.year).slice(2)}` : d.year}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

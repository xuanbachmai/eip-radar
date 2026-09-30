"use client";

import { scaleLinear } from "d3-scale";
import { TRACK_LABEL, trackColor } from "@/lib/colors";
import { median, type AgePoint } from "@/lib/derive";
import { DataTable, Figure, useTooltip } from "./frame";

export interface AgeGroup {
  slug: string;
  name: string;
  points: AgePoint[];
}

export function AgeBeeswarm({ groups }: { groups: AgeGroup[] }) {
  const medians = groups.map((g) => ({ name: g.name, m: median(g.points.map((p) => p.years)) }));
  const first = medians[0];
  const last = medians[medians.length - 1];
  const longest = [...medians].sort((a, b) => b.m - a.m)[0];
  const caption =
    first && last && longest
      ? `Median time from proposal to mainnet: ${first.m.toFixed(1)} y for ${first.name}, ${longest.m.toFixed(1)} y for ${longest.name} (longest), ${last.m.toFixed(1)} y for ${last.name}.`
      : "No shipped Final EIPs.";
  const table = (
    <DataTable
      columns={["Upgrade", "EIP", "Title", "Years to mainnet"]}
      numeric={[3]}
      rows={groups.flatMap((g) => g.points.map((p) => [g.name, p.eip, p.title, p.years.toFixed(2)]))}
    />
  );
  return (
    <Figure caption={caption} table={table} minHeight={groups.length * 34}>
      {(width) => <Swarm width={width} groups={groups} />}
    </Figure>
  );
}

function Swarm({ width, groups }: { width: number; groups: AgeGroup[] }) {
  const tip = useTooltip();
  const labelW = width < 480 ? 88 : 120;
  const rowH = 34;
  const r = 4;
  const maxYears = Math.max(1, ...groups.flatMap((g) => g.points.map((p) => p.years)));
  const x = scaleLinear().domain([0, Math.ceil(maxYears)]).range([labelW, width - 12]);
  const height = groups.length * rowH + 22;

  return (
    <svg width={width} height={height} role="img" aria-label="Years from proposal to activation, per upgrade" className="block">
      {x.ticks(Math.min(8, Math.ceil(maxYears))).map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={0} y2={height - 20} stroke="var(--line)" />
          <text x={x(t)} y={height - 6} textAnchor="middle" fontSize={10} fill="var(--muted)" className="num">
            {t}y
          </text>
        </g>
      ))}
      {groups.map((g, gi) => {
        const cy0 = gi * rowH + rowH / 2;
        // 1-D dodge: place points left to right, stacking alternately above/below when they collide.
        const placed: { p: AgePoint; cx: number; cy: number }[] = [];
        for (const p of [...g.points].sort((a, b) => a.years - b.years)) {
          const cx = x(p.years);
          let k = 0;
          let cy = cy0;
          while (placed.some((q) => Math.hypot(q.cx - cx, q.cy - cy) < r * 2 + 0.5) && k < 12) {
            k++;
            cy = cy0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (r * 2 - 1);
          }
          placed.push({ p, cx, cy });
        }
        const m = median(g.points.map((p) => p.years));
        return (
          <g key={g.slug}>
            <text x={labelW - 10} y={cy0} dominantBaseline="middle" textAnchor="end" fontSize={12} fill="var(--fg)">
              {g.name}
            </text>
            {Number.isFinite(m) ? <line x1={x(m)} x2={x(m)} y1={cy0 - 12} y2={cy0 + 12} stroke="var(--fg)" strokeWidth={2} /> : null}
            {placed.map(({ p, cx, cy }) => {
              const label = `EIP-${p.eip}: ${p.title} · ${TRACK_LABEL[p.track]} · ${p.years.toFixed(1)} years to ${g.name}`;
              return (
                <a
                  key={p.eip}
                  href={`/eips/${p.eip}`}
                  aria-label={label}
                  onMouseEnter={(e) => tip.show(label, e.currentTarget)}
                  onMouseLeave={tip.hide}
                  onFocus={(e) => tip.show(label, e.currentTarget)}
                  onBlur={tip.hide}
                >
                  <circle className="mark" cx={cx} cy={cy} r={r} fill={trackColor(p.track)} stroke="var(--surface)" strokeWidth={0.75} />
                </a>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

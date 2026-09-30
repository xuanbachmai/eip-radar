"use client";

import { scaleLinear } from "d3-scale";
import { TRACK_LABEL, trackColor } from "@/lib/colors";
import type { AuthorRow } from "@/lib/derive";
import { TRACKS } from "@/lib/types";
import { DataTable, Figure, Legend, useTooltip } from "./frame";

export function AuthorActivity({ rows }: { rows: AuthorRow[] }) {
  const lead = rows[0];
  const caption = lead
    ? `Top ${rows.length} authors by Core EIPs in motion (Draft, Review, Last Call). ${lead.name} leads with ${lead.total}. Co-authored EIPs count for every author.`
    : "No EIPs in motion.";
  const table = (
    <DataTable
      columns={["Author", "In motion", ...TRACKS.map((t) => TRACK_LABEL[t])]}
      numeric={[1, ...TRACKS.map((_, i) => i + 2)]}
      rows={rows.map((r) => [r.name, r.total, ...TRACKS.map((t) => r.byTrack[t] ?? 0)])}
    />
  );
  return (
    <Figure
      caption={caption}
      table={table}
      minHeight={rows.length * 22}
      controls={<Legend items={TRACKS.map((t) => ({ label: TRACK_LABEL[t], color: trackColor(t) }))} />}
    >
      {(width) => <Bars width={width} rows={rows} />}
    </Figure>
  );
}

function Bars({ width, rows }: { width: number; rows: AuthorRow[] }) {
  const tip = useTooltip();
  const labelW = Math.min(170, width * 0.38);
  const rowH = 22;
  const x = scaleLinear()
    .domain([0, Math.max(1, ...rows.map((r) => r.total))])
    .range([0, width - labelW - 30]);
  return (
    <svg width={width} height={rows.length * rowH} role="img" aria-label="Authors ranked by EIPs in motion" className="block">
      {rows.map((r, i) => {
        let acc = 0;
        const y = i * rowH;
        const label = `${r.name}: ${r.total} in motion — ${TRACKS.filter((t) => r.byTrack[t])
          .map((t) => `${TRACK_LABEL[t]} ${r.byTrack[t]}`)
          .join(", ")}`;
        return (
          <g
            key={r.name + i}
            tabIndex={0}
            aria-label={label}
            onMouseEnter={(e) => tip.show(label, e.currentTarget)}
            onMouseLeave={tip.hide}
            onFocus={(e) => tip.show(label, e.currentTarget)}
            onBlur={tip.hide}
          >
            <text x={labelW - 8} y={y + rowH / 2} dominantBaseline="middle" textAnchor="end" fontSize={12} fill="var(--fg)">
              {r.name.length > 24 ? `${r.name.slice(0, 23)}…` : r.name}
            </text>
            {TRACKS.map((t) => {
              const n = r.byTrack[t] ?? 0;
              if (!n) return null;
              const x0 = labelW + x(acc);
              acc += n;
              return <rect key={t} className="mark" x={x0} y={y + 4} width={Math.max(0, x(n) - 1)} height={rowH - 8} fill={trackColor(t)} />;
            })}
            <text x={labelW + x(r.total) + 4} y={y + rowH / 2} dominantBaseline="middle" fontSize={11} fill="var(--muted)" className="num">
              {r.total}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

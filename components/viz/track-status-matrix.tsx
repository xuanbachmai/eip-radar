"use client";

import Link from "next/link";
import { TRACK_LABEL, statusColor, trackColor } from "@/lib/colors";
import type { Track } from "@/lib/types";
import { DataTable, Figure, Legend, useTooltip } from "./frame";

const STATUSES = ["Final", "Last Call", "Review", "Draft", "Stagnant", "Withdrawn"] as const;

export interface MatrixRow {
  track: Track;
  counts: Record<string, number>;
  total: number;
}

export function TrackStatusMatrix({ rows, caption }: { rows: MatrixRow[]; caption: string }) {
  const table = (
    <DataTable
      columns={["Track", ...STATUSES, "Total"]}
      numeric={[1, 2, 3, 4, 5, 6, 7]}
      rows={rows.map((r) => [TRACK_LABEL[r.track], ...STATUSES.map((s) => r.counts[s] ?? 0), r.total])}
    />
  );
  return (
    <Figure
      caption={caption}
      table={table}
      minHeight={rows.length * 30 + 20}
      controls={<Legend items={STATUSES.map((s) => ({ label: s, color: statusColor(s), hatch: s === "Withdrawn" }))} />}
    >
      {(width) => <MatrixSvg width={width} rows={rows} />}
    </Figure>
  );
}

function MatrixSvg({ width, rows }: { width: number; rows: MatrixRow[] }) {
  const tip = useTooltip();
  const labelW = width < 480 ? 74 : 96;
  const totalW = 44;
  const barW = width - labelW - totalW;
  const rowH = 30;
  const barH = 18;
  const height = rows.length * rowH;

  return (
    <svg width={width} height={height} role="img" aria-label="Status mix per roadmap track" className="block">
      <defs>
        <pattern id="matrix-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="5" height="5" fill="var(--status-withdrawn)" />
          <line x1="0" y1="0" x2="0" y2="5" stroke="var(--hatch)" strokeWidth="1.5" />
        </pattern>
      </defs>
      {rows.map((r, i) => {
        let x = labelW;
        const y = i * rowH + (rowH - barH) / 2;
        return (
          <g key={r.track}>
            <Link href={`/tracks/${r.track}`}>
              <circle cx={6} cy={y + barH / 2} r={4} fill={trackColor(r.track)} />
              <text x={16} y={y + barH / 2} dominantBaseline="middle" fontSize={12} fill="var(--fg)">
                {TRACK_LABEL[r.track]}
              </text>
            </Link>
            {STATUSES.map((s) => {
              const n = r.counts[s] ?? 0;
              if (!n) return null;
              const w = (n / r.total) * barW;
              const x0 = x;
              x += w;
              const label = `${TRACK_LABEL[r.track]} · ${s}: ${n} of ${r.total} (${Math.round((n / r.total) * 100)}%)`;
              return (
                <g
                  key={s}
                  tabIndex={0}
                  aria-label={label}
                  onMouseEnter={(e) => tip.show(label, e.currentTarget)}
                  onMouseLeave={tip.hide}
                  onFocus={(e) => tip.show(label, e.currentTarget)}
                  onBlur={tip.hide}
                >
                  <rect
                    className="mark"
                    x={x0}
                    y={y}
                    width={Math.max(0, w - 1)}
                    height={barH}
                    fill={s === "Withdrawn" ? "url(#matrix-hatch)" : statusColor(s)}
                  />
                  {w > 22 ? (
                    <text
                      x={x0 + 4}
                      y={y + barH / 2}
                      dominantBaseline="middle"
                      fontSize={10}
                      className="num pointer-events-none"
                      fill={s === "Final" || s === "Last Call" ? "var(--surface)" : "var(--fg)"}
                    >
                      {n}
                    </text>
                  ) : null}
                </g>
              );
            })}
            <text x={width} y={y + barH / 2} dominantBaseline="middle" textAnchor="end" fontSize={12} className="num" fill="var(--muted)">
              {r.total}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

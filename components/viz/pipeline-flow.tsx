"use client";

import { TRACK_LABEL, statusColor, trackColor } from "@/lib/colors";
import { TRACKS, type Track } from "@/lib/types";
import { DataTable, Figure, Legend, svgPoint, useTooltip } from "./frame";

/** counts[status][track] */
export type StatusTrackCounts = Record<string, Partial<Record<Track, number>>>;

/**
 * Pipeline as a funnel. Current status is all the repo records, so paths are inferred:
 * every EIP entered as Draft; anything at Review or beyond passed through the earlier stages;
 * Stagnant and Withdrawn are drawn as leaving from Draft (where the large majority die).
 */
export function PipelineFlow({ counts }: { counts: StatusTrackCounts }) {
  const c = (s: string) => sum(counts[s]);
  const total = ["Draft", "Review", "Last Call", "Final", "Stagnant", "Withdrawn"].reduce((a, s) => a + c(s), 0);
  const dead = c("Stagnant") + c("Withdrawn");
  const caption = `${dead} of ${total} Core EIPs (${Math.round((dead / total) * 100)}%) ended Stagnant or Withdrawn; ${c("Final")} reached Final.`;
  const table = (
    <DataTable
      columns={["Status", ...TRACKS.map((t) => TRACK_LABEL[t]), "Total"]}
      numeric={TRACKS.map((_, i) => i + 1).concat(TRACKS.length + 1)}
      rows={["Draft", "Review", "Last Call", "Final", "Stagnant", "Withdrawn"].map((s) => [
        s,
        ...TRACKS.map((t) => counts[s]?.[t] ?? 0),
        c(s),
      ])}
    />
  );
  return (
    <Figure
      caption={caption}
      table={table}
      minHeight={300}
      controls={<Legend items={TRACKS.map((t) => ({ label: TRACK_LABEL[t], color: trackColor(t), round: true }))} />}
    >
      {(width) => <FlowSvg width={width} counts={counts} />}
    </Figure>
  );
}

function sum(r: Partial<Record<Track, number>> | undefined) {
  return r ? Object.values(r).reduce((a, b) => a + (b ?? 0), 0) : 0;
}

function add(...rs: (Partial<Record<Track, number>> | undefined)[]): Partial<Record<Track, number>> {
  const out: Partial<Record<Track, number>> = {};
  for (const r of rs) for (const t of TRACKS) out[t] = (out[t] ?? 0) + (r?.[t] ?? 0);
  return out;
}

interface Band {
  from: string;
  to: string;
  byTrack: Partial<Record<Track, number>>;
}

function ribbon(x0: number, y0: number, x1: number, y1: number, h: number) {
  const mx = (x0 + x1) / 2;
  return `M${x0},${y0}C${mx},${y0} ${mx},${y1} ${x1},${y1}L${x1},${y1 + h}C${mx},${y1 + h} ${mx},${y0 + h} ${x0},${y0 + h}Z`;
}

function FlowSvg({ width, counts }: { width: number; counts: StatusTrackCounts }) {
  const tip = useTooltip();
  const narrow = width < 560;
  const height = narrow ? 300 : 340;
  const nodeW = 10;
  const labelW = narrow ? 92 : 128;

  const reachedLastCall = add(counts["Last Call"], counts.Final);
  const reachedReview = add(counts.Review, reachedLastCall);
  const entered = add(counts.Draft, reachedReview, counts.Stagnant, counts.Withdrawn);
  const total = sum(entered);

  const gap = 18;
  const k = (height - 24 - gap * 2) / total;

  const colX = {
    Draft: 0,
    Review: (width - labelW) * 0.3,
    "Last Call": (width - labelW) * 0.56,
    Final: width - labelW - nodeW,
  } as const;

  // Nodes: Draft stack is [→Review | open Draft | →Stagnant | →Withdrawn]
  const top = 20;
  const nodes = {
    Draft: { x: colX.Draft, y: top, h: sum(entered) * k },
    Review: { x: colX.Review, y: top, h: sum(reachedReview) * k },
    "Last Call": { x: colX["Last Call"], y: top, h: sum(reachedLastCall) * k },
    Final: { x: colX.Final, y: top, h: sum(counts.Final) * k },
    Stagnant: { x: colX.Final, y: top + sum(counts.Final) * k + gap * 1.5, h: sum(counts.Stagnant) * k },
    Withdrawn: { x: colX.Final, y: 0, h: sum(counts.Withdrawn) * k },
  };
  nodes.Withdrawn.y = nodes.Stagnant.y + nodes.Stagnant.h + gap;

  const draftOpen = sum(counts.Draft) * k;
  const sourceY: Record<string, number> = {
    "Draft→Review": nodes.Draft.y,
    "Draft→Stagnant": nodes.Draft.y + sum(reachedReview) * k + draftOpen,
    "Draft→Withdrawn": nodes.Draft.y + (sum(reachedReview) + sum(counts.Draft) + sum(counts.Stagnant)) * k,
    "Review→Last Call": nodes.Review.y,
    "Last Call→Final": nodes["Last Call"].y,
  };
  const bands: Band[] = [
    { from: "Draft", to: "Review", byTrack: reachedReview },
    { from: "Review", to: "Last Call", byTrack: reachedLastCall },
    { from: "Last Call", to: "Final", byTrack: counts.Final ?? {} },
    { from: "Draft", to: "Stagnant", byTrack: counts.Stagnant ?? {} },
    { from: "Draft", to: "Withdrawn", byTrack: counts.Withdrawn ?? {} },
  ];

  const open: { node: keyof typeof nodes; n: number; label: string }[] = [
    { node: "Draft", n: sum(counts.Draft), label: "in Draft" },
    { node: "Review", n: sum(counts.Review), label: "in Review" },
    { node: "Last Call", n: sum(counts["Last Call"]), label: "in Last Call" },
  ];

  return (
    <svg width={width} height={height + 8} role="img" aria-label="Pipeline flow from Draft to Final, Stagnant and Withdrawn" className="block">
      <defs>
        <pattern id="flow-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="5" height="5" fill="var(--status-withdrawn)" />
          <line x1="0" y1="0" x2="0" y2="5" stroke="var(--hatch)" strokeWidth="1.5" />
        </pattern>
      </defs>
      {bands.map((b) => {
        const s = nodes[b.from as keyof typeof nodes];
        const t = nodes[b.to as keyof typeof nodes];
        let sy = sourceY[`${b.from}→${b.to}`]!;
        let ty = t.y;
        const x0 = s.x + nodeW;
        const x1 = t.x;
        return (
          <g key={`${b.from}-${b.to}`}>
            {TRACKS.map((tr) => {
              const n = b.byTrack[tr] ?? 0;
              if (!n) return null;
              const h = n * k;
              const d = ribbon(x0, sy, x1, ty, h);
              sy += h;
              ty += h;
              const label = `${TRACK_LABEL[tr]}: ${n} EIP${n === 1 ? "" : "s"} ${b.from} → ${b.to}`;
              return (
                <path
                  key={tr}
                  d={d}
                  fill={trackColor(tr)}
                  fillOpacity={0.55}
                  stroke={trackColor(tr)}
                  strokeOpacity={0.9}
                  strokeWidth={0.5}
                  tabIndex={0}
                  aria-label={label}
                  className="mark outline-none hover:fill-opacity-90 focus:fill-opacity-90"
                  onMouseEnter={(e) => tip.show(label, svgPoint(e))}
                  onMouseMove={(e) => tip.show(label, svgPoint(e))}
                  onMouseLeave={tip.hide}
                  onFocus={(e) => tip.show(label, e.currentTarget)}
                  onBlur={tip.hide}
                />
              );
            })}
          </g>
        );
      })}

      {(Object.keys(nodes) as (keyof typeof nodes)[]).map((name) => {
        const n = nodes[name];
        const isSink = name === "Final" || name === "Stagnant" || name === "Withdrawn";
        return (
          <g key={name}>
            <rect
              x={n.x}
              y={n.y}
              width={nodeW}
              height={Math.max(1, n.h)}
              fill={name === "Withdrawn" ? "url(#flow-hatch)" : statusColor(name)}
              stroke="var(--line-strong)"
              strokeWidth={0.5}
            />
            {isSink ? (
              <text x={n.x + nodeW + 6} y={n.y + Math.max(n.h, 10) / 2} dominantBaseline="middle" fontSize={12} fill="var(--fg)">
                <tspan fontWeight={600}>{name}</tspan>
                <tspan className="num" fill="var(--muted)" dx={6}>
                  {Math.round(n.h / k)}
                </tspan>
              </text>
            ) : (
              <text x={n.x + (name === "Draft" ? 0 : nodeW / 2)} y={n.y - 7} textAnchor={name === "Draft" ? "start" : "middle"} fontSize={12} fontWeight={600} fill="var(--fg)">
                {name}
              </text>
            )}
          </g>
        );
      })}

      {open.map((o) => {
        if (!o.n) return null;
        const n = nodes[o.node];
        const y = o.node === "Draft" ? n.y + sum(reachedReview) * k + (o.n * k) / 2 : n.y + n.h - (o.n * k) / 2;
        return (
          <text key={o.node} x={n.x + nodeW + 4} y={y} dominantBaseline="middle" fontSize={11} fill="var(--muted)">
            <tspan className="num">{o.n}</tspan> {o.label}
          </text>
        );
      })}
    </svg>
  );
}

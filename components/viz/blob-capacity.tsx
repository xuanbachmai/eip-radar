"use client";

import { scaleLinear, scaleUtc } from "d3-scale";
import type { BlobStep } from "@/lib/derive";
import { DataTable, Figure, Legend, useTooltip } from "./frame";

/**
 * Target and max blobs per block as step lines over real mainnet activation times. Steps whose
 * values are still TODO (or undated) are drawn as an open, dashed continuation of the last known step.
 */
export function BlobCapacity({ steps, now }: { steps: BlobStep[]; now: number }) {
  const known = steps.filter((s) => s.timestamp && s.target !== null && s.max !== null);
  const pending = steps.filter((s) => !known.includes(s));
  const first = known[0];
  const last = known[known.length - 1];
  const caption =
    first && last
      ? `Blob target rose from ${first.target} to ${last.target} (max ${first.max} → ${last.max}) between ${first.name} and ${last.name}${
          pending.length ? `; ${pending.map((p) => p.name).join(", ")} not yet set` : ""
        }.`
      : "No blob parameters parsed.";
  const table = (
    <DataTable
      columns={["Upgrade", "Mainnet", "Target", "Max"]}
      numeric={[2, 3]}
      rows={steps.map((s) => [
        s.name,
        s.timestamp ? new Date(s.timestamp * 1000).toISOString().slice(0, 10) : "not set",
        s.target ?? "TODO",
        s.max ?? "TODO",
      ])}
    />
  );
  return (
    <Figure
      caption={caption}
      table={table}
      minHeight={240}
      controls={
        <Legend
          items={[
            { label: "Max blobs / block", color: "var(--track-surge)" },
            { label: "Target blobs / block", color: "var(--fg)" },
          ]}
        />
      }
    >
      {(width) => <BlobSvg width={width} known={known} pending={pending} now={now} />}
    </Figure>
  );
}

function BlobSvg({ width, known, pending, now }: { width: number; known: BlobStep[]; pending: BlobStep[]; now: number }) {
  const tip = useTooltip();
  const m = { top: 16, right: 56, bottom: 24, left: 28 };
  const height = 240;
  if (!known.length) return null;

  const start = new Date(known[0]!.timestamp! * 1000 - 60 * 86_400_000);
  const end = new Date(Math.max(now, ...pending.map((p) => (p.timestamp ?? 0) * 1000)) + 120 * 86_400_000);
  const x = scaleUtc().domain([start, end]).range([m.left, width - m.right]);
  const yMax = Math.max(...known.map((s) => s.max!));
  const y = scaleLinear().domain([0, yMax * 1.15]).nice().range([height - m.bottom, m.top]);

  const path = (key: "target" | "max") => {
    let d = "";
    known.forEach((s, i) => {
      const x0 = x(new Date(s.timestamp! * 1000));
      const next = known[i + 1];
      const x1 = next ? x(new Date(next.timestamp! * 1000)) : x(new Date(now));
      const yy = y(s[key]!);
      d += `${i === 0 ? "M" : "L"}${x0},${yy}H${x1}`;
    });
    return d;
  };
  const lastKnown = known[known.length - 1]!;
  const nowX = x(new Date(now));
  const endX = width - m.right;

  return (
    <svg width={width} height={height} role="img" aria-label="Blob target and max per block over time" className="block overflow-visible">
      {y.ticks(5).map((t) => (
        <g key={t}>
          <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke="var(--line)" />
          <text x={m.left - 6} y={y(t)} dominantBaseline="middle" textAnchor="end" fontSize={10} fill="var(--muted)" className="num">
            {t}
          </text>
        </g>
      ))}
      {x.ticks(width < 480 ? 3 : 6).map((t) => (
        <text key={t.getTime()} x={x(t)} y={height - 6} textAnchor="middle" fontSize={10} fill="var(--muted)" className="num">
          {t.toISOString().slice(0, 7)}
        </text>
      ))}

      <path d={path("max")} fill="none" stroke="var(--track-surge)" strokeWidth={2.5} />
      <path d={path("target")} fill="none" stroke="var(--fg)" strokeWidth={2} />
      {/* open continuation: next values not yet decided */}
      <path d={`M${nowX},${y(lastKnown.max!)}H${endX}`} stroke="var(--track-surge)" strokeWidth={2} strokeDasharray="4 3" opacity={0.7} />
      <path d={`M${nowX},${y(lastKnown.target!)}H${endX}`} stroke="var(--fg)" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.6} />
      <text x={endX + 4} y={y(lastKnown.max!)} dominantBaseline="middle" fontSize={10} fill="var(--muted)">
        {pending.length ? `${pending[0]!.name}: TBD` : "current"}
      </text>

      <line x1={nowX} x2={nowX} y1={m.top} y2={height - m.bottom} stroke="var(--fg)" strokeDasharray="2 3" opacity={0.4} />

      {known.map((s) => {
        const cx = x(new Date(s.timestamp! * 1000));
        const label = `${s.name} · ${new Date(s.timestamp! * 1000).toISOString().slice(0, 10)} · target ${s.target}, max ${s.max}`;
        return (
          <g
            key={s.slug}
            tabIndex={0}
            aria-label={label}
            onMouseEnter={(e) => tip.show(label, e.currentTarget)}
            onMouseLeave={tip.hide}
            onFocus={(e) => tip.show(label, e.currentTarget)}
            onBlur={tip.hide}
          >
            <line x1={cx} x2={cx} y1={y(s.max!)} y2={height - m.bottom} stroke="var(--line-strong)" strokeDasharray="1 2" />
            <circle className="mark" cx={cx} cy={y(s.max!)} r={4} fill="var(--track-surge)" stroke="var(--surface)" />
            <circle className="mark" cx={cx} cy={y(s.target!)} r={3.5} fill="var(--fg)" stroke="var(--surface)" />
            <text x={cx + 4} y={y(s.max!) - 8} fontSize={10} fill="var(--fg)" fontWeight={600}>
              {s.name}
            </text>
            <text x={cx + 4} y={y(s.target!) + 13} fontSize={10} fill="var(--muted)" className="num">
              {s.target}/{s.max}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

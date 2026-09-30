"use client";

import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationNodeDatum } from "d3-force";
import { useMemo, useState } from "react";
import { TRACK_LABEL, trackColor } from "@/lib/colors";
import type { Track } from "@/lib/types";
import { DataTable, Figure, useTooltip } from "./frame";

export interface GraphEip {
  eip: number;
  title: string;
  track: Track;
  status: string;
  requires: number[];
  upgrades: string[];
}

export interface GraphFilter {
  kind: "track" | "upgrade";
  value: string;
  label: string;
}

interface Node extends SimulationNodeDatum {
  id: number;
  e?: GraphEip;
  inFilter: boolean;
  indeg: number;
}

export function DependencyGraph({ eips, filters, initial }: { eips: GraphEip[]; filters: GraphFilter[]; initial: string }) {
  const [key, setKey] = useState(initial);
  const filter = filters.find((f) => `${f.kind}:${f.value}` === key) ?? filters[0]!;
  const byId = useMemo(() => new Map(eips.map((e) => [e.eip, e])), [eips]);

  const { nodes, links } = useMemo(() => {
    const members = eips.filter((e) => (filter.kind === "track" ? e.track === filter.value : e.upgrades.includes(filter.value)));
    const ids = new Set(members.map((e) => e.eip));
    const links: { source: number; target: number }[] = [];
    // Keep edges where at least one end is in the filter; pull in the other end as context.
    for (const e of eips) {
      for (const r of e.requires) {
        if (ids.has(e.eip) || ids.has(r)) links.push({ source: e.eip, target: r });
      }
    }
    const all = new Set([...ids, ...links.flatMap((l) => [l.source, l.target])]);
    const indeg = new Map<number, number>();
    for (const l of links) indeg.set(l.target, (indeg.get(l.target) ?? 0) + 1);
    const nodes: Node[] = [...all].map((id) => ({ id, e: byId.get(id), inFilter: ids.has(id), indeg: indeg.get(id) ?? 0 }));
    return { nodes, links };
  }, [eips, filter, byId]);

  const connected = nodes.filter((n) => n.indeg > 0 || links.some((l) => l.source === n.id));
  const top = [...nodes].sort((a, b) => b.indeg - a.indeg)[0];
  const caption = `${filter.label}: ${nodes.filter((n) => n.inFilter).length} EIPs, ${links.length} "requires" edges${
    top && top.indeg ? `; most-required is EIP-${top.id} (${top.indeg})` : ""
  }. Grey nodes are dependencies outside the selection.`;

  const table = (
    <DataTable
      columns={["EIP", "Title", "Requires", "Required by (in view)"]}
      rows={connected
        .filter((n) => n.inFilter)
        .sort((a, b) => a.id - b.id)
        .map((n) => [
          n.id,
          n.e?.title ?? "(not Core)",
          links
            .filter((l) => l.source === n.id)
            .map((l) => l.target)
            .join(", "),
          links
            .filter((l) => l.target === n.id)
            .map((l) => l.source)
            .join(", "),
        ])}
    />
  );

  return (
    <Figure
      caption={caption}
      table={table}
      minHeight={420}
      controls={
        <label className="inline-flex items-center gap-2">
          <span className="text-muted">Show</span>
          <select
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="rounded border border-line bg-surface px-2 py-1 text-sm"
          >
            <optgroup label="Roadmap track">
              {filters
                .filter((f) => f.kind === "track")
                .map((f) => (
                  <option key={f.value} value={`track:${f.value}`}>
                    {f.label}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Upgrade">
              {filters
                .filter((f) => f.kind === "upgrade")
                .map((f) => (
                  <option key={f.value} value={`upgrade:${f.value}`}>
                    {f.label}
                  </option>
                ))}
            </optgroup>
          </select>
        </label>
      }
    >
      {(width) => <GraphSvg key={key} width={width} nodes={nodes} links={links} />}
    </Figure>
  );
}

function GraphSvg({ width, nodes: input, links: inputLinks }: { width: number; nodes: Node[]; links: { source: number; target: number }[] }) {
  const tip = useTooltip();
  const height = Math.max(360, Math.min(560, width * 0.7));
  const [hover, setHover] = useState<number | null>(null);

  const { nodes, links } = useMemo(() => {
    const nodes = input.map((n) => ({ ...n }));
    const links = inputLinks.map((l) => ({ ...l }));
    const sim = forceSimulation<Node>(nodes)
      .force("link", forceLink<Node, { source: number | Node; target: number | Node }>(links).id((d) => d.id).distance(38).strength(0.6))
      .force("charge", forceManyBody().strength(-60))
      .force("x", forceX(width / 2).strength(0.07))
      .force("y", forceY(height / 2).strength(0.1))
      .force("collide", forceCollide<Node>((d) => radius(d) + 2))
      .stop();
    for (let i = 0; i < 260; i++) sim.tick();
    for (const n of nodes) {
      n.x = Math.max(12, Math.min(width - 12, n.x ?? 0));
      n.y = Math.max(12, Math.min(height - 12, n.y ?? 0));
    }
    return { nodes, links: links as unknown as { source: Node; target: Node }[] };
  }, [input, inputLinks, width, height]);

  const neighbours = new Set<number>();
  if (hover !== null) {
    for (const l of links) {
      if (l.source.id === hover) neighbours.add(l.target.id);
      if (l.target.id === hover) neighbours.add(l.source.id);
    }
  }

  return (
    <svg width={width} height={height} role="img" aria-label="Dependency graph of requires relationships" className="block">
      <defs>
        <marker id="dep-arrow" viewBox="0 0 6 6" refX="6" refY="3" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0L6,3L0,6z" fill="var(--faint)" />
        </marker>
      </defs>
      {links.map((l, i) => {
        const dx = l.target.x! - l.source.x!;
        const dy = l.target.y! - l.source.y!;
        const len = Math.hypot(dx, dy) || 1;
        const r = radius(l.target) + 2;
        const on = hover !== null && (l.source.id === hover || l.target.id === hover);
        return (
          <line
            key={i}
            x1={l.source.x}
            y1={l.source.y}
            x2={l.target.x! - (dx / len) * r}
            y2={l.target.y! - (dy / len) * r}
            stroke={on ? "var(--fg)" : "var(--line-strong)"}
            strokeWidth={on ? 1.5 : 1}
            markerEnd="url(#dep-arrow)"
            opacity={hover === null || on ? 1 : 0.25}
          />
        );
      })}
      {nodes.map((n) => {
        const label = `EIP-${n.id}${n.e ? `: ${n.e.title} · ${TRACK_LABEL[n.e.track]} · ${n.e.status}` : " (not a Core EIP)"} · required by ${n.indeg}`;
        const dim = hover !== null && hover !== n.id && !neighbours.has(n.id);
        return (
          <a
            key={n.id}
            href={`/eips/${n.id}`}
            aria-label={label}
            onMouseEnter={(e) => {
              setHover(n.id);
              tip.show(label, e.currentTarget);
            }}
            onMouseLeave={() => {
              setHover(null);
              tip.hide();
            }}
            onFocus={(e) => {
              setHover(n.id);
              tip.show(label, e.currentTarget);
            }}
            onBlur={() => {
              setHover(null);
              tip.hide();
            }}
            style={{ opacity: dim ? 0.3 : 1 }}
          >
            <circle
              className="mark"
              cx={n.x}
              cy={n.y}
              r={radius(n)}
              fill={n.inFilter && n.e ? trackColor(n.e.track) : "var(--surface-2)"}
              stroke={n.inFilter ? "var(--surface)" : "var(--line-strong)"}
              strokeWidth={1}
            />
            {n.indeg >= 3 || hover === n.id ? (
              <text x={n.x! + radius(n) + 2} y={n.y} dominantBaseline="middle" fontSize={10} fill="var(--fg)" className="num pointer-events-none">
                {n.id}
              </text>
            ) : null}
          </a>
        );
      })}
    </svg>
  );
}

function radius(n: Node) {
  return 4 + Math.sqrt(n.indeg) * 3;
}

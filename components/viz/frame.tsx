"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

/** Width of an element, tracked with ResizeObserver. `null` until measured. */
export function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number | null] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry!.contentRect.width);
      setWidth((prev) => (prev === w ? prev : w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

// ---- Tooltip ---------------------------------------------------------------------------------

interface Tip {
  content: ReactNode;
  x: number;
  y: number;
}

interface TipApi {
  show: (content: ReactNode, target: Element | { x: number; y: number }) => void;
  hide: () => void;
}

const TipContext = createContext<TipApi>({ show: () => {}, hide: () => {} });
export const useTooltip = () => useContext(TipContext);

/** Props that wire a mark to the tooltip on both hover and keyboard focus. */
export function tipProps(api: TipApi, content: ReactNode) {
  return {
    onMouseEnter: (e: React.MouseEvent<Element>) => api.show(content, e.currentTarget),
    onMouseLeave: api.hide,
    onFocus: (e: React.FocusEvent<Element>) => api.show(content, e.currentTarget),
    onBlur: api.hide,
  };
}

/** Pointer position relative to the chart's outer <svg> (which sits at the figure origin). */
export function svgPoint(e: React.MouseEvent<SVGElement>) {
  const el = e.currentTarget as SVGElement;
  const svg = el.ownerSVGElement ?? (el as SVGSVGElement);
  const r = svg.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top - 4 };
}

// ---- Figure ----------------------------------------------------------------------------------

export interface FigureProps {
  /** One-line reading of the chart, shown as the figcaption. */
  caption: ReactNode;
  /** Accessible table with the same data, inside a <details>. */
  table: ReactNode;
  tableLabel?: string;
  /** Render the chart for a measured width. */
  children: (width: number) => ReactNode;
  /** Reserved height before measurement, to avoid layout shift. */
  minHeight?: number;
  controls?: ReactNode;
  className?: string;
}

export function Figure({ caption, table, tableLabel = "Data table", children, minHeight = 200, controls, className = "" }: FigureProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);

  const show = useCallback<TipApi["show"]>((content, target) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    let x: number, y: number;
    if (target instanceof Element) {
      const r = target.getBoundingClientRect();
      x = r.left + r.width / 2 - box.left;
      y = r.top - box.top;
    } else ({ x, y } = target);
    setTip({ content, x, y });
  }, [ref]);
  const hide = useCallback(() => setTip(null), []);

  return (
    <figure className={`m-0 min-w-0 ${className}`}>
      {controls ? <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">{controls}</div> : null}
      <TipContext.Provider value={{ show, hide }}>
        <div ref={ref} className="relative w-full" style={{ minHeight: width === null ? minHeight : undefined }}>
          {width !== null && width > 0 ? children(width) : null}
          {tip ? (
            <div
              role="tooltip"
              className="pointer-events-none absolute z-20 max-w-[260px] rounded border border-line-strong bg-surface px-2 py-1.5 text-xs shadow-lg"
              style={{
                left: Math.min(Math.max(tip.x, 90), (width ?? 0) - 90),
                top: tip.y,
                transform: "translate(-50%, calc(-100% - 8px))",
              }}
            >
              {tip.content}
            </div>
          ) : null}
        </div>
      </TipContext.Provider>
      <figcaption className="mt-2 text-sm text-muted">{caption}</figcaption>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-muted hover:text-fg">{tableLabel}</summary>
        <div className="mt-2 max-h-[420px] overflow-auto">{table}</div>
      </details>
    </figure>
  );
}

// ---- Shared EIP highlight --------------------------------------------------------------------

interface HighlightApi {
  eip: number | null;
  set: (eip: number | null) => void;
}

const HighlightContext = createContext<HighlightApi>({ eip: null, set: () => {} });
export const useHighlight = () => useContext(HighlightContext);

export function HighlightProvider({ children }: { children: ReactNode }) {
  const [eip, set] = useState<number | null>(null);
  return <HighlightContext.Provider value={{ eip, set }}>{children}</HighlightContext.Provider>;
}

// ---- Table fallback --------------------------------------------------------------------------

export function DataTable({ columns, rows, numeric = [] }: { columns: string[]; rows: (string | number)[][]; numeric?: number[] }) {
  return (
    <table className="w-full border-collapse text-left text-[13px]">
      <thead>
        <tr>
          {columns.map((c, i) => (
            <th key={c} scope="col" className={`border-b border-line px-2 py-1 font-medium text-muted ${numeric.includes(i) ? "text-right" : ""}`}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri} className="border-b border-line/60">
            {r.map((v, i) => (
              <td key={i} className={`px-2 py-1 ${numeric.includes(i) ? "num text-right" : ""}`}>
                {v}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Legend({ items }: { items: { label: string; color: string; hatch?: boolean; round?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className={`inline-block h-2.5 w-2.5 ${i.round ? "rounded-full" : "rounded-[2px]"} ${i.hatch ? "hatch" : ""}`}
            style={{ backgroundColor: i.color, boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.12)" }}
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

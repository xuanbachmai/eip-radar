// Formatting helpers. All dates render in UTC so server and client output match.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtDate(input: string | number | Date): string {
  const d = toDate(input);
  if (!d) return "—";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function fmtDateTimeUtc(input: string | number | Date): string {
  const d = toDate(input);
  if (!d) return "—";
  return `${fmtDate(d)} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
}

export function isoDay(input: string | number | Date): string {
  const d = toDate(input);
  return d ? d.toISOString().slice(0, 10) : "";
}

/** Unix seconds or ISO → Date. */
export function toDate(input: string | number | Date): Date | undefined {
  if (input instanceof Date) return input;
  if (typeof input === "number") return new Date(input < 1e12 ? input * 1000 : input);
  if (!input) return undefined;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(input) ? `${input}T00:00:00Z` : input);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function relativeTime(from: number, now = Date.now()): string {
  const s = Math.round((now - from) / 1000);
  const abs = Math.abs(s);
  const suffix = s >= 0 ? "ago" : "from now";
  if (abs < 60) return s >= 0 ? "just now" : "in under a minute";
  const [n, unit] =
    abs < 3600 ? [Math.round(abs / 60), "min"] : abs < 86_400 ? [Math.round(abs / 3600), "h"] : [Math.round(abs / 86_400), "d"];
  return `${n} ${unit} ${suffix}`;
}

export type FreshnessLevel = "ok" | "warn" | "bad";

export function freshnessLevel(checkedAt: number, now = Date.now()): FreshnessLevel {
  const h = (now - checkedAt) / 3.6e6;
  return h < 12 ? "ok" : h < 48 ? "warn" : "bad";
}

export const eipLabel = (n: number) => `EIP-${n}`;

export function pct(n: number, d: number): string {
  return d ? `${Math.round((n / d) * 100)}%` : "—";
}

export function csvEscape(v: unknown): string {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]!);
  return [cols.join(","), ...rows.map((r) => cols.map((c) => csvEscape(r[c])).join(","))].join("\n") + "\n";
}

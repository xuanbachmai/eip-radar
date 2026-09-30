// Front-matter + markdown section parsing for EIP source files.
//
// The front matter is parsed line-by-line rather than as YAML: EIP headers are flat `key: value`
// pairs, and a strict YAML parser chokes on unquoted colons in titles and turns dates into Date
// objects. Line parsing is both more forgiving and keeps every value as the literal string.

import type { Author } from "./types";

/** Bump whenever parsing output changes so the next sync re-parses every file. */
export const PARSER_VERSION = 2;

export class ParseError extends Error {
  constructor(
    message: string,
    readonly path?: string,
  ) {
    super(path ? `${path}: ${message}` : message);
    this.name = "ParseError";
  }
}

export interface FrontMatter {
  data: Record<string, string>;
  body: string;
}

const BOM = 0xfeff;

export function parseFrontMatter(src: string, path?: string): FrontMatter {
  const text = (src.charCodeAt(0) === BOM ? src.slice(1) : src).replace(/\r\n?/g, "\n");
  if (!text.startsWith("---\n")) throw new ParseError("missing front matter", path);
  const end = text.indexOf("\n---", 3);
  if (end === -1) throw new ParseError("unterminated front matter", path);

  const data: Record<string, string> = {};
  let lastKey: string | undefined;
  for (const line of text.slice(4, end).split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const m = /^([A-Za-z][\w-]*)\s*:\s?(.*)$/.exec(line);
    if (m) {
      lastKey = m[1]!.toLowerCase();
      data[lastKey] = unquote(m[2]!.trim());
    } else if (lastKey && /^\s+\S/.test(line)) {
      // folded continuation line
      data[lastKey] = `${data[lastKey]} ${unquote(line.trim())}`.trim();
    } else {
      throw new ParseError(`unparseable front-matter line: ${JSON.stringify(line)}`, path);
    }
  }
  const bodyStart = text.indexOf("\n", end + 1);
  return { data, body: bodyStart === -1 ? "" : text.slice(bodyStart + 1) };
}

function unquote(v: string): string {
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
    return v.slice(1, -1);
  }
  return v;
}

export interface ParsedEip {
  eip: number;
  title: string;
  description?: string;
  authors: Author[];
  status: string;
  type: string;
  category?: string;
  created: string;
  requires: number[];
  lastCallDeadline?: string;
  withdrawalReason?: string;
  discussionsTo?: string;
  abstract?: string;
  body: string;
}

const REQUIRED_FIELDS = ["eip", "title", "status", "type", "created"] as const;

export function parseEip(src: string, path?: string): ParsedEip {
  const { data, body } = parseFrontMatter(src, path);
  // ERCs moved to ethereum/ERCs in 2023 left stubs behind: `eip`, `category: ERC`, `status: Moved`.
  if (data.status?.toLowerCase() === "moved" && data.eip) {
    return { eip: Number(data.eip), title: "", authors: [], status: "Moved", type: "", category: data.category, created: "", requires: [], body };
  }
  for (const f of REQUIRED_FIELDS) {
    if (!data[f]) throw new ParseError(`missing required field "${f}"`, path);
  }
  const eip = Number(data.eip);
  if (!Number.isInteger(eip) || eip < 0) throw new ParseError(`invalid eip number ${data.eip}`, path);
  if (path) {
    const fileNo = /eip-(\d+)\.md$/.exec(path)?.[1];
    if (fileNo && Number(fileNo) !== eip) throw new ParseError(`eip ${eip} does not match file name`, path);
  }

  const abstract = extractSection(body, "Abstract");
  return {
    eip,
    title: data.title!,
    description: data.description || undefined,
    authors: parseAuthors(data.author ?? ""),
    status: normaliseStatus(data.status!),
    type: data.type!,
    category: data.category || undefined,
    created: data.created!,
    requires: parseNumberList(data.requires),
    lastCallDeadline: data["last-call-deadline"] || undefined,
    withdrawalReason: data["withdrawal-reason"] || undefined,
    discussionsTo: data["discussions-to"] || undefined,
    abstract: abstract ? truncate(plainText(abstract), 400) : undefined,
    body,
  };
}

const STATUS_CANON: Record<string, string> = {
  final: "Final",
  "last call": "Last Call",
  review: "Review",
  draft: "Draft",
  stagnant: "Stagnant",
  withdrawn: "Withdrawn",
  living: "Living",
};

export function normaliseStatus(s: string): string {
  return STATUS_CANON[s.trim().toLowerCase()] ?? s.trim();
}

export function parseNumberList(v: string | undefined): number[] {
  if (!v) return [];
  return [...v.matchAll(/\d+/g)].map((m) => Number(m[0]));
}

/** Split an EIP `author:` line on top-level commas; keep names and GitHub handles, drop emails. */
export function parseAuthors(line: string): Author[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of line) {
    if (ch === "(" || ch === "<") depth++;
    else if (ch === ")" || ch === ">") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  parts.push(cur);

  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const handle = /\(@([\w-]+)\)/.exec(p)?.[1];
      const name = p
        .replace(/\([^)]*\)/g, "")
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim();
      return handle ? { name: name || handle, handle } : { name };
    })
    .filter((a) => a.name);
}

export interface Section {
  level: number;
  heading: string;
  /** Text between this heading and the next heading of any level. */
  content: string;
}

/** Flat list of ATX headings with their immediate content. Fenced code blocks are respected. */
export function splitSections(body: string): Section[] {
  const out: Section[] = [{ level: 0, heading: "", content: "" }];
  let inFence = false;
  for (const line of body.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const m = !inFence && /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (m) out.push({ level: m[1]!.length, heading: m[2]!, content: "" });
    else out[out.length - 1]!.content += line + "\n";
  }
  return out;
}

/** Content of the first `## <name>` section including its subsections. */
export function extractSection(body: string, name: string): string | undefined {
  const sections = splitSections(body);
  const i = sections.findIndex((s) => s.level > 0 && s.heading.trim().toLowerCase() === name.toLowerCase());
  if (i === -1) return undefined;
  const level = sections[i]!.level;
  let text = sections[i]!.content;
  for (let j = i + 1; j < sections.length && sections[j]!.level > level; j++) {
    text += `${"#".repeat(sections[j]!.level)} ${sections[j]!.heading}\n${sections[j]!.content}`;
  }
  return text.trim();
}

/** Crude markdown → plain text, good enough for abstracts. */
export function plainText(md: string): string {
  return md
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(^|\W)[*_](\S[^*_]*?)[*_](?=\W|$)/g, "$1$2")
    .replace(/^#+\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > n * 0.8 ? cut.slice(0, sp) : cut).replace(/[\s,;:.]+$/, "")}…`;
}

export interface MarkdownTable {
  header: string[];
  rows: string[][];
}

/** Parse the first GitHub-flavoured markdown table in `text`. */
export function parseTable(text: string): MarkdownTable | undefined {
  const lines = text.split("\n");
  for (let i = 0; i + 1 < lines.length; i++) {
    if (!isTableRow(lines[i]!) || !/^\s*\|?\s*:?-{2,}/.test(lines[i + 1]!)) continue;
    const header = cells(lines[i]!);
    const rows: string[][] = [];
    for (let j = i + 2; j < lines.length && isTableRow(lines[j]!); j++) rows.push(cells(lines[j]!));
    return { header, rows };
  }
  return undefined;
}

function isTableRow(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line);
}

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

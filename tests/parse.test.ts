import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ParseError, parseAuthors, parseEip, parseFrontMatter, parseTable, splitSections } from "../lib/parse";

const fixture = (name: string) => readFileSync(join(__dirname, "fixtures/eips", name), "utf8");

describe("parseEip", () => {
  it("parses a Final Core EIP", () => {
    const e = parseEip(fixture("eip-4844.md"), "EIPS/eip-4844.md");
    expect(e).toMatchObject({
      eip: 4844,
      title: "Shard Blob Transactions",
      status: "Final",
      type: "Standards Track",
      category: "Core",
      created: "2022-02-25",
      requires: [1559, 2718, 2930, 4895],
    });
    expect(e.discussionsTo).toMatch(/^https:\/\/ethereum-magicians\.org\//);
    expect(e.authors[0]).toEqual({ name: "Vitalik Buterin", handle: "vbuterin" });
    expect(e.abstract!.length).toBeLessThanOrEqual(401);
  });

  it("keeps withdrawal-reason", () => {
    expect(parseEip(fixture("eip-3074.md")).withdrawalReason).toBe("Superseded by EIP-7702");
  });

  it("handles EIPs without description or requires", () => {
    const e = parseEip(fixture("eip-2.md"));
    expect(e.description).toBeUndefined();
    expect(e.requires).toEqual([]);
  });

  it("indexes moved-to-ERCs stubs without failing", () => {
    expect(parseEip(fixture("eip-7528.md"))).toMatchObject({ eip: 7528, status: "Moved", category: "ERC" });
  });

  it("handles colons, quotes, odd lists, lowercase status and fenced headings", () => {
    const e = parseEip(fixture("edge-cases.md"));
    expect(e.title).toBe("Colon: in the title");
    expect(e.description).toBe("Quoted description");
    expect(e.status).toBe("Last Call");
    expect(e.lastCallDeadline).toBe("2026-10-01");
    expect(e.requires).toEqual([1559, 2718, 4844]);
    expect(e.abstract).toBe("This links and code and bold text.");
    expect(e.authors).toEqual([
      { name: "Jane Doe", handle: "jane" },
      { name: "John Roe" },
      { name: "Solo Dev" },
      { name: "A Name", handle: "ab-c" },
    ]);
    expect(splitSections(e.body).map((s) => s.heading)).toEqual(["", "Abstract", "Specification"]);
  });

  it.each([
    ["malformed-no-frontmatter.md", /missing front matter/],
    ["malformed-unterminated.md", /unterminated front matter/],
    ["malformed-missing-status.md", /missing required field "status"/],
  ])("rejects %s", (name, msg) => {
    expect(() => parseEip(fixture(name), name)).toThrow(ParseError);
    expect(() => parseEip(fixture(name), name)).toThrow(msg);
  });

  it("rejects a number that disagrees with the file name", () => {
    expect(() => parseEip(fixture("eip-2.md"), "EIPS/eip-3.md")).toThrow(/does not match/);
  });

  it("tolerates CRLF and a BOM", () => {
    const src = String.fromCharCode(0xfeff) + fixture("eip-2.md").replace(/\n/g, "\r\n");
    expect(parseFrontMatter(src).data.eip).toBe("2");
  });
});

describe("parseAuthors", () => {
  it("drops emails and keeps handles", () => {
    expect(parseAuthors("Francesco D'Amato <f@x.org>, Potuz (@potuz)")).toEqual([
      { name: "Francesco D'Amato" },
      { name: "Potuz", handle: "potuz" },
    ]);
  });
});

describe("parseTable", () => {
  it("reads header and rows", () => {
    const t = parseTable("x\n| a | b |\n|---|:-:|\n| 1 | `2` |\n| 3 |  |\n\nafter");
    expect(t).toEqual({ header: ["a", "b"], rows: [["1", "`2`"], ["3", ""]] });
  });
});

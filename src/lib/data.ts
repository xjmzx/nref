// Turns the raw files into the two lists the app shows, and cross-links them.
//
//   kinds  ←  registry-of-kinds/schema.yaml  ∪  the "Event Kinds" table in
//             nips/README.md  ∪  the suite's own kinds (lib/suite.ts)
//   NIPs   ←  nips/NN.md, with status taken from the README's list
//
// The registry and the README table overlap but neither contains the other, so
// every kind records which of them it came from.

import yaml from "js-yaml";
import type { Loaded } from "./tauri";
import { SUITE_KINDS, type SuiteUse } from "./suite";

// ---------------------------------------------------------------- kinds ----

export type KindClass = "regular" | "replaceable" | "ephemeral" | "addressable";

/** NIP-01's ranges. */
export function kindClass(n: number): KindClass {
  if (n === 0 || n === 3 || (n >= 10000 && n < 20000)) return "replaceable";
  if (n >= 20000 && n < 30000) return "ephemeral";
  if (n >= 30000 && n < 40000) return "addressable";
  return "regular";
}

/** One position in a tag array after the name. */
export interface Slot {
  type: string;
  required: boolean;
  variadic: boolean;
  either?: string[];
  min?: number;
  max?: number;
}

export interface TagDef {
  name: string;
  /** The name is a prefix match rather than an exact one. */
  prefix: boolean;
  description?: string;
  slots: Slot[];
}

export interface ExternalRef {
  label: string;
  url?: string;
}

export interface KindEntry {
  /** Stable id: "1059", or "9000-9030" for a README range. */
  key: string;
  kind: number;
  kindEnd?: number;
  description: string;
  klass: KindClass;
  inRegistry: boolean;
  inReadme: boolean;
  /** Registry `in_use`; undefined when the registry doesn't say. */
  inUse?: boolean;
  contentType?: string;
  required: string[];
  multiple: string[];
  tags: TagDef[];
  /** NIPs the README table names for this kind. */
  nips: string[];
  external: ExternalRef[];
  /** e.g. "deprecated", from the README table. */
  note?: string;
  /** NIPs whose text mentions this kind without the table saying so. */
  mentionedIn: string[];
  suite?: SuiteUse;
  /** Lowercased haystack for search. */
  search: string;
}

function flattenSlots(next: unknown): Slot[] {
  const out: Slot[] = [];
  let n = next as Record<string, unknown> | undefined;
  // Aliases make the chain a shared object graph; the depth cap is only there
  // so a hand-edited cycle can't hang the app.
  while (n && typeof n === "object" && out.length < 32) {
    out.push({
      type: String(n.type ?? "free"),
      required: n.required === true,
      variadic: n.variadic === true,
      either: Array.isArray(n.either) ? n.either.map(String) : undefined,
      min: typeof n.min === "number" ? n.min : undefined,
      max: typeof n.max === "number" ? n.max : undefined,
    });
    n = n.next as Record<string, unknown> | undefined;
  }
  return out;
}

function toTag(t: Record<string, unknown>): TagDef {
  return {
    name: String(t.name ?? "?"),
    prefix: t.prefix === true,
    description: typeof t.description === "string" ? t.description : undefined,
    slots: flattenSlots(t.next),
  };
}

interface ReadmeKindRow {
  start: number;
  end: number;
  description: string;
  nips: string[];
  external: ExternalRef[];
  note?: string;
}

const NIP_HREF = /^([0-9A-Z]{2})\.md(#.*)?$/;

function section(readme: string, heading: string): string {
  const start = readme.indexOf(`\n## ${heading}`);
  if (start < 0) return "";
  const end = readme.indexOf("\n## ", start + 1);
  return readme.slice(start, end < 0 ? undefined : end);
}

function stripMd(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim();
}

function parseReadmeKinds(readme: string): ReadmeKindRow[] {
  // Reference-style link targets: `[marmot]: https://…`
  const refs = new Map<string, string>();
  for (const m of readme.matchAll(/^\[([^\]]+)\]:\s*(\S+)/gm)) refs.set(m[1].toLowerCase(), m[2]);

  const rows: ReadmeKindRow[] = [];
  for (const line of section(readme, "Event Kinds").split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 3) continue;
    // "`1630`-`1633`", "`39000-9`" (the suffix replaces the tail), or "`7`".
    const m = cells[0].replace(/`/g, "").match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) continue;
    const start = Number(m[1]);
    const end = m[2] === undefined ? start : Number(m[1].slice(0, Math.max(0, m[1].length - m[2].length)) + m[2]);

    const nips: string[] = [];
    const external: ExternalRef[] = [];
    let rest = cells[2];
    rest = rest.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label: string, href: string) => {
      const n = href.match(NIP_HREF);
      if (n) nips.push(n[1]);
      else external.push({ label, url: href });
      return "";
    });
    rest = rest.replace(/\[([^\]]+)\](?:\[([^\]]+)\])?/g, (_, label: string, ref?: string) => {
      external.push({ label, url: refs.get((ref ?? label).toLowerCase()) });
      return "";
    });
    const note = rest.replace(/[(),]/g, " ").trim() || undefined;

    rows.push({ start, end: Math.max(start, end), description: stripMd(cells[1]), nips, external, note });
  }
  return rows;
}

// ----------------------------------------------------------------- NIPs ----

export interface NipEntry {
  /** "01", "5A". */
  id: string;
  title: string;
  /** The backticked labels under the title: draft, optional, relay… */
  badges: string[];
  unrecommended: boolean;
  /** Why, from the README list or the file's own warning. */
  reason?: string;
  /** Hex-lettered id (5A, EE) rather than a plain number. */
  lettered: boolean;
  summary: string;
  text: string;
  /** Kinds the README table assigns to this NIP (keys into the kind list). */
  kinds: string[];
  /** Kinds its text mentions beyond those. */
  mentions: string[];
  searchHead: string;
  searchBody: string;
}

function parseNip(id: string, text: string): NipEntry {
  const lines = text.split("\n");
  // The title is the setext h2: the first line underlined with dashes.
  let title = "";
  for (let i = 0; i + 1 < lines.length; i++) {
    if (/^-{3,}\s*$/.test(lines[i + 1]) && lines[i].trim() && !/^NIP-/.test(lines[i])) {
      title = stripMd(lines[i]);
      break;
    }
  }
  // Only near the top: further down, a line of nothing but code spans is prose.
  const badgeIdx = lines.slice(0, 12).findIndex((l) => /^(`[^`]+`\s*)+$/.test(l.trim()));
  const badges = badgeIdx < 0 ? [] : [...lines[badgeIdx].matchAll(/`([^`]+)`/g)].map((m) => m[1]);

  const warn = text.match(/^>\s*__Warning__\s*`unrecommended`:?\s*(.*)$/m);

  // First real paragraph after the badges.
  let summary = "";
  for (let i = Math.max(badgeIdx + 1, 0); i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) {
      if (summary) break;
      continue;
    }
    if (/^([#>|`=-]|NIP-)/.test(l) || (i + 1 < lines.length && /^[-=]{3,}\s*$/.test(lines[i + 1]))) {
      if (summary) break;
      continue;
    }
    summary += (summary ? " " : "") + l;
  }

  return {
    id,
    title: title || `NIP-${id}`,
    badges,
    unrecommended: badges.includes("unrecommended") || !!warn,
    reason: warn?.[1]?.trim() || undefined,
    lettered: !/^\d\d$/.test(id),
    summary: stripMd(summary),
    text,
    kinds: [],
    mentions: [],
    searchHead: "",
    searchBody: text.toLowerCase(),
  };
}

/** Kind numbers a NIP's prose refers to: `kind:1059`, `"kind": 1`, kind `7`. */
function mentionedKinds(text: string): Set<number> {
  const out = new Set<number>();
  for (const m of text.matchAll(/\bkinds?\b["'`:\s]{1,4}(\d{1,5})\b/gi)) out.add(Number(m[1]));
  return out;
}

// ---------------------------------------------------------------- build ----

export interface Data {
  kinds: KindEntry[];
  kindByKey: Map<string, KindEntry>;
  nips: NipEntry[];
  nipById: Map<string, NipEntry>;
  genericTags: TagDef[];
  /** Why a source could not be used, for the status line. */
  problems: string[];
}

export function build(loaded: Loaded): Data {
  const problems: string[] = [];
  const kinds = new Map<string, KindEntry>();

  const blank = (kind: number, kindEnd?: number): KindEntry => ({
    key: kindEnd === undefined ? String(kind) : `${kind}-${kindEnd}`,
    kind,
    kindEnd,
    description: "",
    klass: kindClass(kind),
    inRegistry: false,
    inReadme: false,
    required: [],
    multiple: [],
    tags: [],
    nips: [],
    external: [],
    mentionedIn: [],
    suite: kindEnd === undefined ? SUITE_KINDS[kind] : undefined,
    search: "",
  });

  // 1. The registry.
  let genericTags: TagDef[] = [];
  if (loaded.schema === null) {
    problems.push("schema.yaml not found in the registry-of-kinds checkout");
  } else {
    try {
      const doc = yaml.load(loaded.schema) as Record<string, unknown>;
      const gt = (doc.generic_tags ?? {}) as Record<string, unknown>;
      genericTags = Object.entries(gt).map(([name, next]) => ({ name, prefix: false, slots: flattenSlots(next) }));
      for (const [k, raw] of Object.entries((doc.kinds ?? {}) as Record<string, Record<string, unknown>>)) {
        const n = Number(k);
        if (!Number.isInteger(n)) continue;
        const e = blank(n);
        e.inRegistry = true;
        e.description = String(raw.description ?? "");
        e.inUse = typeof raw.in_use === "boolean" ? raw.in_use : undefined;
        e.contentType = (raw.content as Record<string, unknown> | undefined)?.type as string | undefined;
        e.required = Array.isArray(raw.required) ? raw.required.map(String) : [];
        e.multiple = Array.isArray(raw.multiple) ? raw.multiple.map(String) : [];
        e.tags = Array.isArray(raw.tags) ? raw.tags.map((t) => toTag(t as Record<string, unknown>)) : [];
        kinds.set(e.key, e);
      }
    } catch (err) {
      problems.push(`schema.yaml did not parse: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 2. The README table. A single-kind row merges into the registry's entry; a
  //    range row lends its NIPs to every registry kind inside it, and stands as
  //    its own entry only when the registry has none of them.
  if (loaded.readme === null) {
    problems.push("README.md not found in the nips checkout");
  } else {
    for (const row of parseReadmeKinds(loaded.readme)) {
      const targets: KindEntry[] = [];
      if (row.start === row.end) {
        const key = String(row.start);
        if (!kinds.has(key)) kinds.set(key, blank(row.start));
        targets.push(kinds.get(key)!);
      } else {
        for (const e of kinds.values())
          if (e.kindEnd === undefined && e.kind >= row.start && e.kind <= row.end) targets.push(e);
        if (targets.length === 0) {
          const e = blank(row.start, row.end);
          kinds.set(e.key, e);
          targets.push(e);
        }
      }
      for (const e of targets) {
        e.inReadme = true;
        if (!e.description) e.description = row.description;
        for (const n of row.nips) if (!e.nips.includes(n)) e.nips.push(n);
        e.external.push(...row.external);
        if (row.note) e.note = row.note;
      }
    }
  }

  // 3. The suite's own kinds, so one the public sources don't list still shows.
  for (const [k, use] of Object.entries(SUITE_KINDS)) {
    if (!kinds.has(k)) {
      const e = blank(Number(k));
      e.description = use.role;
      kinds.set(k, e);
    }
  }

  // NIPs.
  const nips = loaded.nipFiles.map((f) => parseNip(f.id, f.text));
  const nipById = new Map(nips.map((n) => [n.id, n]));
  if (loaded.readme !== null) {
    // `- ~~[NIP-03: …](03.md) --- **unrecommended**: reason~~`
    for (const m of section(loaded.readme, "List").matchAll(/^- (~~)?\[NIP-[0-9A-Z]{2}: (.*?)\]\(([0-9A-Z]{2})\.md\)(.*)$/gm)) {
      const nip = nipById.get(m[3]);
      if (!nip) continue;
      // A file without the usual setext title (A3 uses `#`/`##`) takes the
      // README's.
      if (nip.title === `NIP-${nip.id}`) nip.title = stripMd(m[2]);
      if (!m[1]) continue;
      nip.unrecommended = true;
      const why = m[4].match(/\*\*unrecommended\*\*:?\s*(.*?)~*$/);
      if (why?.[1]) nip.reason = stripMd(why[1]);
    }
  }

  // Cross-links.
  const list = [...kinds.values()].sort((a, b) => a.kind - b.kind || a.key.localeCompare(b.key));
  for (const e of list) {
    e.nips = e.nips.filter((n) => nipById.has(n));
    for (const n of e.nips) nipById.get(n)!.kinds.push(e.key);
  }
  for (const nip of nips) {
    for (const n of mentionedKinds(nip.text)) {
      const e = kinds.get(String(n));
      if (!e || e.nips.includes(nip.id)) continue;
      e.mentionedIn.push(nip.id);
      nip.mentions.push(e.key);
    }
    nip.mentions.sort((a, b) => Number(a) - Number(b));
    nip.searchHead = `${nip.id} nip-${nip.id} ${nip.title} ${nip.badges.join(" ")}`.toLowerCase();
  }
  for (const e of list) {
    e.search = [
      e.key,
      e.description,
      e.klass,
      e.contentType ?? "",
      e.note ?? "",
      ...e.nips.map((n) => `nip-${n}`),
      ...e.external.map((x) => x.label),
      ...e.tags.map((t) => t.name),
      e.suite ? `${e.suite.role} ${e.suite.apps}` : "",
    ]
      .join(" ")
      .toLowerCase();
  }

  return { kinds: list, kindByKey: kinds, nips, nipById, genericTags, problems };
}

export function kindLabel(e: KindEntry): string {
  return e.kindEnd === undefined ? String(e.kind) : `${e.kind}–${e.kindEnd}`;
}

/** https://github.com/owner/repo for a GitHub remote in any of its spellings
 *  (https, git@github.com:, or an ssh host alias — which names an account, not
 *  a host, so it is only trusted when the path still reads owner/repo). */
export function githubBase(remote: string | null): string | null {
  if (!remote) return null;
  const m = remote.match(/^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?\/?$/) ?? remote.match(/^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/);
  return m ? `https://github.com/${m[1]}` : null;
}

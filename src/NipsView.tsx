import { useEffect, useMemo, useRef, type RefObject } from "react";
import { ExternalLink } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { cn } from "./lib/cn";
import { kindLabel, type Data, type NipEntry } from "./lib/data";
import { useStored } from "./lib/ui";
import { Badge, Chip, ChipRow, Empty, LinkPill, SearchBox, Split } from "./components/bits";
import { NipDoc, scrollToAnchor } from "./components/NipDoc";

type Series = "all" | "numbered" | "lettered";
type Status = "all" | "current" | "unrecommended" | "final" | "mandatory" | "relay";
const STATUSES: [Status, string, string][] = [
  ["current", "current", "Not marked unrecommended"],
  ["unrecommended", "unrecommended", "Struck through in the README list"],
  ["final", "final", "Carries the `final` label"],
  ["mandatory", "mandatory", "Carries the `mandatory` label"],
  ["relay", "relay", "Carries the `relay` label — relays have something to implement"],
];

function matchStatus(n: NipEntry, s: Status): boolean {
  if (s === "all") return true;
  if (s === "current") return !n.unrecommended;
  if (s === "unrecommended") return n.unrecommended;
  return n.badges.includes(s);
}

interface Row {
  nip: NipEntry;
  /** Where the query hit in the body, when it missed the title. */
  snippet?: string;
}

/** Where a term sits in the body, or -1. A bare number has to stand alone:
 *  NIPs are full of hex ids and keys, and "46" is inside most of them. */
function bodyIndex(n: NipEntry, term: string): number {
  if (!/^\d+$/.test(term)) return n.searchBody.indexOf(term);
  return n.searchBody.search(new RegExp(`(?<![0-9a-f])${term}(?![0-9a-f])`));
}

function snippet(n: NipEntry, term: string): string | undefined {
  const i = bodyIndex(n, term);
  if (i < 0) return undefined;
  const from = Math.max(0, i - 40);
  return (from > 0 ? "…" : "") + n.text.slice(from, i + term.length + 60).replace(/\s+/g, " ") + "…";
}

export default function NipsView({
  data,
  selected,
  anchor,
  onSelect,
  onKind,
  query,
  setQuery,
  searchRef,
  sourceUrl,
}: {
  data: Data;
  selected: string | null;
  /** Heading to scroll to once the NIP is shown (from a `17.md#x` link). */
  anchor: string | null;
  onSelect: (id: string | null, anchor?: string) => void;
  onKind: (key: string) => void;
  query: string;
  setQuery: (q: string) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  sourceUrl: (id: string) => string | null;
}) {
  const [series, setSeries] = useStored<Series>("nref.nips.series", "all");
  const [status, setStatus] = useStored<Status>("nref.nips.status", "all");
  const [onlyKinds, setOnlyKinds] = useStored<"0" | "1">("nref.nips.kinds", "0");

  const rows = useMemo<Row[]>(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const out: (Row & { rank: number })[] = [];
    for (const nip of data.nips) {
      if (series === "numbered" && nip.lettered) continue;
      if (series === "lettered" && !nip.lettered) continue;
      if (!matchStatus(nip, status)) continue;
      if (onlyKinds === "1" && nip.kinds.length === 0) continue;
      if (terms.length === 0) {
        out.push({ nip, rank: 0 });
        continue;
      }
      const head = terms.every((t) => nip.searchHead.includes(t));
      if (head) out.push({ nip, rank: 0 });
      else if (terms.every((t) => nip.searchHead.includes(t) || bodyIndex(nip, t) >= 0))
        out.push({ nip, rank: 1, snippet: snippet(nip, terms.find((t) => !nip.searchHead.includes(t))!) });
    }
    // Title hits first; ids keep their order within each group.
    return out.sort((a, b) => a.rank - b.rank);
  }, [data, query, series, status, onlyKinds]);

  const listRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected) listRef.current?.querySelector(`[data-id="${selected}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selected]);
  // A new NIP starts at the top, or at the heading the link named.
  useEffect(() => {
    const el = docRef.current;
    if (!el) return;
    el.scrollTop = 0;
    if (anchor) scrollToAnchor(el, anchor);
  }, [selected, anchor]);

  const move = (delta: number) => {
    if (rows.length === 0) return;
    const i = rows.findIndex((r) => r.nip.id === selected);
    onSelect(rows[Math.min(rows.length - 1, Math.max(0, i < 0 ? 0 : i + delta))].nip.id);
  };

  const nip = selected ? (data.nipById.get(selected) ?? null) : null;
  const url = nip ? sourceUrl(nip.id) : null;

  const list = (
    <>
      <div className="p-3 space-y-2 border-b border-surface/60">
        <SearchBox ref={searchRef} value={query} onChange={setQuery} onMove={move} placeholder="number, title, or any text…   ( / )" />
        <ChipRow label="series">
          <Chip on={series === "all"} onClick={() => setSeries("all")}>
            all
          </Chip>
          <Chip on={series === "numbered"} onClick={() => setSeries(series === "numbered" ? "all" : "numbered")} title="01.md … 99.md">
            01–99
          </Chip>
          <Chip on={series === "lettered"} onClick={() => setSeries(series === "lettered" ? "all" : "lettered")} title="Two-character hex ids: 5A.md, B7.md, EE.md…">
            lettered
          </Chip>
        </ChipRow>
        <ChipRow label="status">
          <Chip on={status === "all"} onClick={() => setStatus("all")}>
            all
          </Chip>
          {STATUSES.map(([s, label, hint]) => (
            <Chip key={s} on={status === s} onClick={() => setStatus(status === s ? "all" : s)} title={hint}>
              {label}
            </Chip>
          ))}
        </ChipRow>
        <ChipRow label="show">
          <Chip on={onlyKinds === "1"} onClick={() => setOnlyKinds(onlyKinds === "1" ? "0" : "1")} title="NIPs the README table names for at least one kind">
            defines kinds
          </Chip>
        </ChipRow>
      </div>
      <div className="px-3 py-1.5 text-[11px] text-muted border-b border-surface/60">
        {rows.length} of {data.nips.length} NIPs
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {rows.map(({ nip: n, snippet: sn }) => (
          <button
            key={n.id}
            data-id={n.id}
            onClick={() => onSelect(n.id)}
            className={cn(
              "w-full px-3 py-1.5 text-left border-b border-surface/30",
              n.id === selected ? "bg-accent/15 hover:bg-accent/20" : "hover:bg-surface/60",
            )}
          >
            <div className="flex items-center gap-2 text-sm">
              <span className="font-mono text-xs text-accent w-6 shrink-0">{n.id}</span>
              <span className={cn("flex-1 min-w-0 truncate", n.unrecommended && "line-through text-muted")}>{n.title}</span>
              {n.kinds.length > 0 && (
                <span className="text-[10px] text-muted shrink-0">
                  {n.kinds.length} {n.kinds.length === 1 ? "kind" : "kinds"}
                </span>
              )}
            </div>
            {sn && <div className="pl-8 text-[11px] text-muted truncate">{sn}</div>}
          </button>
        ))}
        {rows.length === 0 && <div className="p-6 text-sm text-muted text-center">nothing matches</div>}
      </div>
    </>
  );

  const detail = nip ? (
    <div ref={docRef} className="flex-1 overflow-y-auto">
      <div className="px-5 pt-4 pb-3 border-b border-surface/60 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-sm font-bold text-accent mr-1">NIP-{nip.id}</span>
          {nip.badges.map((b) => (
            <Badge key={b} tone={b === "unrecommended" ? "alert" : b === "mandatory" ? "warn" : b === "final" ? "ok" : "muted"}>
              {b}
            </Badge>
          ))}
          {nip.unrecommended && !nip.badges.includes("unrecommended") && <Badge tone="alert">unrecommended</Badge>}
          {nip.lettered && <Badge title="Hex-lettered id rather than a plain number">lettered</Badge>}
          {url && (
            <button onClick={() => void openUrl(url)} title={url} className="ml-auto text-muted hover:text-fg flex items-center gap-1 text-xs">
              source <ExternalLink size={12} />
            </button>
          )}
        </div>
        {nip.unrecommended && nip.reason && <p className="text-xs text-alert">unrecommended: {nip.reason}</p>}
        {nip.kinds.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted mr-1">kinds</span>
            {nip.kinds.map((k) => {
              const e = data.kindByKey.get(k)!;
              return (
                <LinkPill key={k} onClick={() => onKind(k)} title={e.description}>
                  {kindLabel(e)}
                </LinkPill>
              );
            })}
          </div>
        )}
        {nip.mentions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted mr-1">mentions</span>
            {nip.mentions.map((k) => (
              <LinkPill key={k} tone="muted" onClick={() => onKind(k)} title={data.kindByKey.get(k)?.description}>
                {k}
              </LinkPill>
            ))}
          </div>
        )}
      </div>
      <div className="px-5 py-5 max-w-3xl">
        <NipDoc
          text={nip.text}
          hasNip={(id) => data.nipById.has(id)}
          onNip={(id, a) => onSelect(id, a)}
          onAnchor={(a) => scrollToAnchor(docRef.current, a)}
        />
      </div>
    </div>
  ) : (
    <Empty>Pick a NIP to read it.</Empty>
  );

  return <Split list={list} detail={detail} showDetail={nip !== null} onCloseDetail={() => onSelect(null)} />;
}

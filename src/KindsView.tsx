import { useEffect, useMemo, useRef, type RefObject } from "react";
import { ExternalLink } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { cn } from "./lib/cn";
import { kindLabel, type Data, type KindClass, type KindEntry } from "./lib/data";
import { useStored } from "./lib/ui";
import { Badge, Chip, ChipRow, Empty, LinkPill, SearchBox, Split } from "./components/bits";
import { TagShape } from "./components/TagShape";

const CLASSES: KindClass[] = ["regular", "replaceable", "ephemeral", "addressable"];
const CLASS_HINT: Record<KindClass, string> = {
  regular: "stored by relays; every event kept",
  replaceable: "0, 3, 10000–19999 — only the latest per pubkey is kept",
  ephemeral: "20000–29999 — not stored",
  addressable: "30000–39999 — only the latest per pubkey + d tag is kept",
};

type Source = "all" | "both" | "registry" | "readme" | "neither";
const SOURCES: [Source, string, string][] = [
  ["all", "all", "Every kind from either source"],
  ["both", "both", "In the registry and in the NIPs README table"],
  ["registry", "registry only", "In schema.yaml but missing from the NIPs README table"],
  ["readme", "README only", "In the NIPs README table but missing from schema.yaml"],
];

function matchSource(e: KindEntry, s: Source): boolean {
  if (s === "all") return true;
  if (s === "both") return e.inRegistry && e.inReadme;
  if (s === "registry") return e.inRegistry && !e.inReadme;
  if (s === "readme") return !e.inRegistry && e.inReadme;
  return !e.inRegistry && !e.inReadme;
}

export default function KindsView({
  data,
  selected,
  onSelect,
  onNip,
  query,
  setQuery,
  searchRef,
}: {
  data: Data;
  selected: string | null;
  onSelect: (key: string | null) => void;
  onNip: (id: string) => void;
  query: string;
  setQuery: (q: string) => void;
  searchRef: RefObject<HTMLInputElement | null>;
}) {
  const [klass, setKlass] = useStored<KindClass | "all">("nref.kinds.class", "all");
  const [source, setSource] = useStored<Source>("nref.kinds.source", "all");
  const [flag, setFlag] = useStored<"all" | "inuse" | "suite" | "nonip">("nref.kinds.flag", "all");

  const rows = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const num = /^\d+$/.test(query.trim()) ? query.trim() : null;
    const out = data.kinds.filter(
      (e) =>
        (klass === "all" || e.klass === klass) &&
        matchSource(e, source) &&
        (flag === "all" ||
          (flag === "inuse" && e.inUse === true) ||
          (flag === "suite" && !!e.suite) ||
          (flag === "nonip" && e.nips.length === 0)) &&
        terms.every((t) => e.search.includes(t)),
    );
    // A bare number puts the exact kind first, then kinds starting with it.
    if (num)
      out.sort(
        (a, b) =>
          Number(b.key === num) - Number(a.key === num) ||
          Number(b.key.startsWith(num)) - Number(a.key.startsWith(num)) ||
          a.kind - b.kind,
      );
    return out;
  }, [data, query, klass, source, flag]);

  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected) listRef.current?.querySelector(`[data-key="${selected}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const move = (delta: number) => {
    if (rows.length === 0) return;
    const i = rows.findIndex((e) => e.key === selected);
    const next = rows[Math.min(rows.length - 1, Math.max(0, i < 0 ? 0 : i + delta))];
    onSelect(next.key);
  };

  const entry = selected ? (data.kindByKey.get(selected) ?? null) : null;

  const list = (
    <>
      <div className="p-3 space-y-2 border-b border-surface/60">
        <SearchBox
          ref={searchRef}
          value={query}
          onChange={setQuery}
          onMove={move}
          placeholder="kind number, name, tag, NIP…   ( / )"
        />
        <ChipRow label="class">
          <Chip on={klass === "all"} onClick={() => setKlass("all")}>
            all
          </Chip>
          {CLASSES.map((c) => (
            <Chip key={c} on={klass === c} onClick={() => setKlass(klass === c ? "all" : c)} title={CLASS_HINT[c]}>
              {c}
            </Chip>
          ))}
        </ChipRow>
        <ChipRow label="source">
          {SOURCES.map(([s, label, hint]) => (
            <Chip key={s} on={source === s} onClick={() => setSource(source === s ? "all" : s)} title={hint}>
              {label}
            </Chip>
          ))}
        </ChipRow>
        <ChipRow label="show">
          <Chip on={flag === "all"} onClick={() => setFlag("all")}>
            all
          </Chip>
          <Chip on={flag === "inuse"} onClick={() => setFlag(flag === "inuse" ? "all" : "inuse")} title="The registry marks it in_use">
            in use
          </Chip>
          <Chip on={flag === "suite"} onClick={() => setFlag(flag === "suite" ? "all" : "suite")} title="Kinds the n-suite itself puts on the wire">
            n-suite
          </Chip>
          <Chip on={flag === "nonip"} onClick={() => setFlag(flag === "nonip" ? "all" : "nonip")} title="No NIP is named for it in the README table">
            no NIP
          </Chip>
        </ChipRow>
      </div>
      <div className="px-3 py-1.5 text-[11px] text-muted border-b border-surface/60">
        {rows.length} of {data.kinds.length} kinds
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {rows.map((e) => (
          <button
            key={e.key}
            data-key={e.key}
            onClick={() => onSelect(e.key)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm border-b border-surface/30",
              e.key === selected ? "bg-accent/15 hover:bg-accent/20" : "hover:bg-surface/60",
            )}
          >
            <span className="font-mono text-xs text-accent w-[4.5rem] shrink-0 text-right">{kindLabel(e)}</span>
            <span className={cn("flex-1 min-w-0 truncate", !e.inRegistry && "text-fg/70")}>{e.description || "—"}</span>
            {e.suite && <span className="w-1.5 h-1.5 rounded-full bg-mauve shrink-0" title={`n-suite: ${e.suite.apps}`} />}
            <span className="font-mono text-[10px] text-muted shrink-0 w-12 text-right truncate">
              {e.nips.length > 0 ? e.nips.join(" ") : ""}
            </span>
          </button>
        ))}
        {rows.length === 0 && <div className="p-6 text-sm text-muted text-center">nothing matches</div>}
      </div>
    </>
  );

  return (
    <Split
      list={list}
      showDetail={entry !== null}
      onCloseDetail={() => onSelect(null)}
      detail={entry ? <KindDetail e={entry} data={data} onNip={onNip} /> : <Empty>Pick a kind to see its tags and the NIP that defines it.</Empty>}
    />
  );
}

function KindDetail({ e, data, onNip }: { e: KindEntry; data: Data; onNip: (id: string) => void }) {
  // Tags the kind's own list doesn't define but its required/multiple lists
  // name, or that every kind may carry.
  const own = new Set(e.tags.map((t) => t.name));
  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5">
      <div>
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="font-mono text-3xl font-bold text-accent">{kindLabel(e)}</span>
          <h2 className="text-xl font-semibold">{e.description || "(no description)"}</h2>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <Badge title={CLASS_HINT[e.klass]}>{e.klass}</Badge>
          {e.inUse === true && <Badge tone="ok" title="The registry marks this kind in_use">in use</Badge>}
          {e.inUse === false && <Badge tone="warn" title="The registry marks this kind in_use: false">not in use</Badge>}
          {e.note && <Badge tone="warn">{e.note}</Badge>}
          {e.contentType && <Badge title="What .content holds, per the registry">content: {e.contentType}</Badge>}
          {e.inRegistry ? (
            <Badge title="Defined in registry-of-kinds/schema.yaml">registry</Badge>
          ) : (
            <Badge tone="alert" title="Not in registry-of-kinds/schema.yaml">
              not in registry
            </Badge>
          )}
          {e.inReadme ? (
            <Badge title="Listed in the NIPs README kind table">README</Badge>
          ) : (
            <Badge tone="warn" title="Not in the NIPs README kind table">
              not in README
            </Badge>
          )}
        </div>
      </div>

      {e.suite && (
        <div className="rounded-md bg-mauve/10 px-3 py-2 text-sm">
          <span className="text-mauve font-semibold">n-suite</span> <span className="text-fg/90">{e.suite.role}</span>
          <div className="text-xs text-muted mt-0.5">
            {e.suite.apps}
            {!e.inRegistry && !e.inReadme && " — a suite-private kind: neither public source lists it."}
          </div>
        </div>
      )}

      <Block title="Defined by">
        {e.nips.length === 0 && e.external.length === 0 && <span className="text-sm text-muted">No NIP named in the README table.</span>}
        <div className="flex flex-wrap gap-1.5">
          {e.nips.map((n) => (
            <LinkPill key={n} onClick={() => onNip(n)} title={data.nipById.get(n)?.title}>
              NIP-{n} <span className="font-sans text-fg/80">{data.nipById.get(n)?.title}</span>
            </LinkPill>
          ))}
          {e.external.map((x, i) =>
            x.url ? (
              <LinkPill key={i} tone="muted" onClick={() => void openUrl(x.url!)} title={x.url}>
                {x.label} <ExternalLink size={10} className="inline -mt-0.5" />
              </LinkPill>
            ) : (
              <Badge key={i}>{x.label}</Badge>
            ),
          )}
        </div>
      </Block>

      {e.mentionedIn.length > 0 && (
        <Block title="Also mentioned in">
          <div className="flex flex-wrap gap-1.5">
            {e.mentionedIn.map((n) => (
              <LinkPill key={n} tone="muted" onClick={() => onNip(n)} title={data.nipById.get(n)?.title}>
                NIP-{n}
              </LinkPill>
            ))}
          </div>
        </Block>
      )}

      {e.inRegistry && (
        <Block title={`Tags (${e.tags.length})`}>
          {e.tags.length === 0 ? (
            <span className="text-sm text-muted">The registry defines no tags for this kind.</span>
          ) : (
            e.tags.map((t, i) => (
              <TagShape key={i} tag={t} required={e.required.includes(t.name)} multiple={e.multiple.includes(t.name)} />
            ))
          )}
          {e.required.filter((n) => !own.has(n)).length > 0 && (
            <p className="mt-2 text-xs text-warn">
              required but not defined above: {e.required.filter((n) => !own.has(n)).join(", ")}
            </p>
          )}
        </Block>
      )}

      {e.inRegistry && data.genericTags.length > 0 && (
        <Block title="Generic tags (any kind)">
          {data.genericTags.map((t) => (
            <TagShape key={t.name} tag={t} />
          ))}
        </Block>
      )}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[10px] uppercase tracking-wider text-muted mb-1.5">{title}</h3>
      {children}
    </section>
  );
}

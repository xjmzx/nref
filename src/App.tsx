import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookOpen, Download, FolderOpen, Hash, RefreshCw } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { cn } from "./lib/cn";
import { build, githubBase } from "./lib/data";
import { load, pickPath, pull, type Loaded, type RepoState, type Which } from "./lib/tauri";
import { ago, shortVersion, useStored, useToast } from "./lib/ui";
import KindsView from "./KindsView";
import NipsView from "./NipsView";

// nref has two sections over two git checkouts: Kinds (registry-of-kinds'
// schema.yaml merged with the NIPs README table) and NIPs (the NN.md files,
// rendered). They cross-link, so a shared back-stack lives here.

type Section = "kinds" | "nips";
const THEMES = ["mono", "fizx", "upleb"] as const;
type Theme = (typeof THEMES)[number];

interface Loc {
  section: Section;
  kind: string | null;
  nip: string | null;
  anchor: string | null;
}

export default function App() {
  const [theme, setTheme] = useStored<Theme>("nref.theme", "mono", THEMES);
  const [section, setSection] = useStored<Section>("nref.section", "kinds", ["kinds", "nips"]);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"load" | "pull" | null>("load");
  const [toast, setToast] = useToast();
  const [version, setVersion] = useState("");

  const [kind, setKind] = useState<string | null>(null);
  const [nip, setNip] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [back, setBack] = useState<Loc[]>([]);
  const [kindQuery, setKindQuery] = useState("");
  const [nipQuery, setNipQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const root = document.documentElement.classList;
    root.toggle("theme-upleb", theme === "upleb");
    root.toggle("theme-mono", theme === "mono");
  }, [theme]);

  useEffect(() => {
    getVersion().then(setVersion, () => {});
  }, []);

  const reload = useCallback(async () => {
    setBusy("load");
    try {
      setLoaded(await load());
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const data = useMemo(() => (loaded ? build(loaded) : null), [loaded]);

  const pullBoth = async () => {
    if (!loaded) return;
    setBusy("pull");
    const lines: string[] = [];
    let failed = false;
    for (const which of ["nips", "kinds"] as Which[]) {
      if (!loaded[which].isGit) continue;
      try {
        const out = await pull(which);
        // git's last line is the useful one: "Already up to date." or the
        // files-changed summary.
        lines.push(`${which}: ${out.split("\n").pop() || "ok"}`);
      } catch (e) {
        failed = true;
        lines.push(`${which}: ${String(e).split("\n")[0]}`);
      }
    }
    await reload();
    setToast({ text: lines.join("  ·  ") || "no git checkouts to pull", tone: failed ? "alert" : "ok" });
  };

  const choose = async (which: Which) => {
    try {
      if (await pickPath(which)) await reload();
    } catch (e) {
      setToast({ text: String(e), tone: "alert" });
    }
  };

  // Cross-section jumps push where you were; plain list clicks don't, or the
  // back button would replay every row you arrowed past.
  const here = (): Loc => ({ section, kind, nip, anchor });
  const jumpToNip = (id: string, a?: string) => {
    setBack((b) => [...b.slice(-49), here()]);
    setSection("nips");
    setNip(id);
    setAnchor(a ?? null);
  };
  const jumpToKind = (key: string) => {
    setBack((b) => [...b.slice(-49), here()]);
    setSection("kinds");
    setKind(key);
  };
  const goBack = useCallback(() => {
    setBack((b) => {
      const last = b[b.length - 1];
      if (!last) return b;
      setSection(last.section);
      setKind(last.kind);
      setNip(last.nip);
      setAnchor(last.anchor);
      return b.slice(0, -1);
    });
  }, [setSection]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if ((e.key === "/" && !typing) || (e.key === "k" && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (e.key === "ArrowLeft" && e.altKey) {
        e.preventDefault();
        goBack();
      } else if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === "1" || e.key === "2")) {
        setSection(e.key === "1" ? "kinds" : "nips");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goBack, setSection]);

  const nipsBase = githubBase(loaded?.nips.remote ?? null);
  const nipsBranch = loaded?.nips.branch && loaded.nips.branch !== "HEAD" ? loaded.nips.branch : "master";

  return (
    <div className="h-full flex flex-col">
      {/* SUITE.md § Top-bar grammar: identity · the one focal readout ·
          controls, with the view switch always last. */}
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 border-b border-surface/60 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length])}
            title={`Theme: ${theme} — click to cycle`}
            aria-label="Switch colour theme"
            className="text-2xl font-bold tracking-tight select-none"
          >
            <span className="text-accent">n</span>
            <span className="text-mauve">ref</span>
          </button>
          {version && (
            <span title={`v${version}`} className="hidden md:inline-flex bg-surface text-mauve font-mono text-xs px-1.5 py-0.5 rounded">
              v{shortVersion(version)}
            </span>
          )}
        </div>

        <div className="min-w-0 overflow-hidden justify-start hidden lg:flex items-center gap-4 text-xs text-muted">
          {data && (
            <>
              <span>
                <span className="text-fg font-mono">{data.kinds.length}</span> kinds
              </span>
              <span>
                <span className="text-fg font-mono">{data.kinds.filter((k) => k.inRegistry).length}</span> in registry
              </span>
              <span>
                <span className="text-fg font-mono">{data.nips.length}</span> NIPs
              </span>
              <span>
                <span className="text-fg font-mono">{data.nips.filter((n) => n.unrecommended).length}</span> unrecommended
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 justify-self-end">
          <IconButton onClick={goBack} disabled={back.length === 0} title="Back  (Alt+←)">
            <ArrowLeft size={14} />
          </IconButton>
          <span className="w-px h-6 bg-surface shrink-0" aria-hidden />
          <IconButton onClick={() => void reload()} disabled={busy !== null} title="Re-read both checkouts from disk">
            <RefreshCw size={14} className={cn(busy === "load" && "animate-spin")} />
          </IconButton>
          <IconButton onClick={() => void pullBoth()} disabled={busy !== null} title="git pull --ff-only in both checkouts">
            <Download size={14} className={cn(busy === "pull" && "animate-pulse")} />
            <span className="hidden md:inline text-xs">pull</span>
          </IconButton>
          <span className="w-px h-6 bg-surface shrink-0" aria-hidden />
          <div className="flex rounded-md bg-surface p-0.5">
            {(
              [
                ["kinds", Hash, "Kinds — the event kind registry  (1)"],
                ["nips", BookOpen, "NIPs — read the specs  (2)"],
              ] as const
            ).map(([s, Icon, label]) => (
              <button
                key={s}
                onClick={() => setSection(s)}
                title={label}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors",
                  section === s ? "bg-bg text-digital" : "text-muted hover:text-fg",
                )}
              >
                <Icon size={14} />
                <span className="hidden md:inline">{s === "kinds" ? "Kinds" : "NIPs"}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {error ? (
        <div className="flex-1 flex items-center justify-center text-sm text-alert p-8">{error}</div>
      ) : !data ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted">reading checkouts…</div>
      ) : section === "kinds" ? (
        <KindsView
          data={data}
          selected={kind}
          onSelect={setKind}
          onNip={jumpToNip}
          query={kindQuery}
          setQuery={setKindQuery}
          searchRef={searchRef}
        />
      ) : (
        <NipsView
          data={data}
          selected={nip}
          anchor={anchor}
          onSelect={(id, a) => {
            // Following a link inside a NIP is a jump; a list click is not.
            if (a !== undefined || (id && nip && data.nipById.get(nip)?.text.includes(`${id}.md`) && id !== nip))
              setBack((b) => [...b.slice(-49), here()]);
            setNip(id);
            setAnchor(a ?? null);
          }}
          onKind={jumpToKind}
          query={nipQuery}
          setQuery={setNipQuery}
          searchRef={searchRef}
          sourceUrl={(id) => (nipsBase ? `${nipsBase}/blob/${nipsBranch}/${id}.md` : null)}
        />
      )}

      <footer className="flex items-center gap-4 px-4 py-1.5 border-t border-surface/60 text-[11px] text-muted whitespace-nowrap overflow-hidden">
        {loaded && (
          <>
            <RepoChip label="nips" repo={loaded.nips} onPick={() => void choose("nips")} />
            <RepoChip label="registry-of-kinds" repo={loaded.kinds} onPick={() => void choose("kinds")} />
          </>
        )}
        <span className={cn("ml-auto truncate", toast?.tone === "alert" ? "text-alert" : toast ? "text-ok" : "text-warn")}>
          {toast?.text ?? data?.problems.join("  ·  ") ?? ""}
        </span>
      </footer>
    </div>
  );
}

function IconButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-surface text-muted hover:text-fg hover:bg-surfaceHover disabled:opacity-40 disabled:hover:bg-surface disabled:hover:text-muted transition-colors"
    >
      {children}
    </button>
  );
}

/** One checkout in the footer: where it is and which commit it shows. */
function RepoChip({ label, repo, onPick }: { label: string; repo: RepoState; onPick: () => void }) {
  return (
    <button
      onClick={onPick}
      title={`${repo.path}\n${repo.subject ?? ""}\n${repo.remote ?? "no remote"}\n\nClick to choose a different folder`}
      className="flex items-center gap-1.5 hover:text-fg min-w-0"
    >
      <FolderOpen size={12} className="shrink-0" />
      <span>{label}</span>
      {!repo.exists ? (
        <span className="text-alert">not found — click to locate</span>
      ) : !repo.isGit ? (
        <span className="text-warn">not a git checkout</span>
      ) : (
        <>
          <span className="font-mono text-fg/80">{repo.head}</span>
          <span className="hidden md:inline">{ago(repo.date)}</span>
        </>
      )}
    </button>
  );
}

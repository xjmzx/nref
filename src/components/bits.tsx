// Small shared pieces: filter chips, the search box, link pills, the
// master/detail frame both sections sit in.

import { forwardRef, type ReactNode } from "react";
import { ArrowLeft, Search, X } from "lucide-react";
import { cn } from "../lib/cn";

export function Chip({
  on,
  onClick,
  title,
  children,
}: {
  on: boolean;
  onClick: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "px-2 py-0.5 rounded text-xs transition-colors whitespace-nowrap",
        on ? "bg-accent/20 text-accent" : "bg-surface text-muted hover:text-fg hover:bg-surfaceHover",
      )}
    >
      {children}
    </button>
  );
}

export function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[10px] uppercase tracking-wider text-muted/70 w-12 shrink-0 pt-1">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

export const SearchBox = forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    /** ArrowUp/ArrowDown/Enter while typing drive the list underneath. */
    onMove: (delta: number) => void;
  }
>(function SearchBox({ value, onChange, placeholder, onMove }, ref) {
  return (
    <div className="relative">
      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            onMove(1);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            onMove(-1);
          } else if (e.key === "Escape") {
            if (value) onChange("");
            else e.currentTarget.blur();
          }
        }}
        placeholder={placeholder}
        spellCheck={false}
        className="w-full bg-surface rounded-md pl-8 pr-8 py-1.5 text-sm placeholder:text-muted/70 outline-none focus:ring-1 focus:ring-accent/50"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          title="Clear"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
});

/** A cross-link: a NIP from a kind, a kind from a NIP. */
export function LinkPill({
  onClick,
  title,
  tone = "accent",
  children,
}: {
  onClick: () => void;
  title?: string;
  tone?: "accent" | "muted";
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "px-2 py-0.5 rounded font-mono text-xs transition-colors",
        tone === "accent"
          ? "bg-accent/10 text-accent hover:bg-accent/25"
          : "bg-surface text-muted hover:text-fg hover:bg-surfaceHover",
      )}
    >
      {children}
    </button>
  );
}

export function Badge({ tone = "muted", title, children }: { tone?: "muted" | "ok" | "warn" | "alert" | "mauve"; title?: string; children: ReactNode }) {
  return (
    <span
      title={title}
      className={cn(
        "px-1.5 py-px rounded text-[10px] uppercase tracking-wide whitespace-nowrap",
        tone === "muted" && "bg-surface text-muted",
        tone === "ok" && "bg-ok/15 text-ok",
        tone === "warn" && "bg-warn/15 text-warn",
        tone === "alert" && "bg-alert/15 text-alert",
        tone === "mauve" && "bg-mauve/15 text-mauve",
      )}
    >
      {children}
    </span>
  );
}

/** List on the left, detail on the right; below md only one shows at a time
 *  and the detail carries a way back. (GNOME's 1.25 text scaling leaves a
 *  1200px window 960 CSS px, so the two-pane layout has to hold from md.) */
export function Split({
  list,
  detail,
  showDetail,
  onCloseDetail,
}: {
  list: ReactNode;
  detail: ReactNode;
  showDetail: boolean;
  onCloseDetail: () => void;
}) {
  return (
    <div className="flex-1 min-h-0 flex">
      <div
        className={cn(
          "w-full md:w-[22rem] lg:w-[26rem] shrink-0 min-h-0 flex-col border-r border-surface/60",
          showDetail ? "hidden md:flex" : "flex",
        )}
      >
        {list}
      </div>
      <div className={cn("flex-1 min-w-0 min-h-0 flex-col", showDetail ? "flex" : "hidden md:flex")}>
        {showDetail && (
          <button
            onClick={onCloseDetail}
            className="md:hidden flex items-center gap-1.5 px-4 py-2 text-xs text-muted hover:text-fg border-b border-surface/60"
          >
            <ArrowLeft size={14} /> list
          </button>
        )}
        {detail}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="flex-1 flex items-center justify-center text-sm text-muted p-8 text-center">{children}</div>;
}

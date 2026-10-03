// One tag definition from schema.yaml, drawn as the array it describes:
//   ["e", <id>, <relay>?, <reply|root>?, <pubkey>?]
// Solid slots are required, faint ones with a "?" optional, "…" repeats.

import { cn } from "../lib/cn";
import type { Slot, TagDef } from "../lib/data";
import { Badge } from "./bits";

function SlotPill({ slot }: { slot: Slot }) {
  const constrained = slot.either && slot.either.length > 0;
  const size =
    slot.min !== undefined || slot.max !== undefined
      ? slot.min === slot.max
        ? `{${slot.min}}`
        : `{${slot.min ?? ""}..${slot.max ?? ""}}`
      : "";
  return (
    <span
      title={[
        constrained ? `one of: ${slot.either!.join(", ")}` : slot.type,
        slot.required ? "required" : "optional",
        slot.variadic ? "repeats to the end of the tag" : "",
        size ? `length ${size}` : "",
      ]
        .filter(Boolean)
        .join(" · ")}
      className={cn(
        "px-1.5 py-0.5 rounded break-all",
        slot.required ? "bg-surfaceHover text-fg" : "bg-surface text-muted",
      )}
    >
      {constrained ? slot.either!.join(" | ") : `<${slot.type}${size}>`}
      {slot.variadic && "…"}
      {!slot.required && "?"}
    </span>
  );
}

export function TagShape({ tag, required, multiple }: { tag: TagDef; required?: boolean; multiple?: boolean }) {
  return (
    <div className="py-2 border-b border-surface/60 last:border-b-0">
      <div className="flex flex-wrap items-center gap-1 font-mono text-xs">
        <span className="text-muted">[</span>
        <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent">
          "{tag.name}
          {tag.prefix && "…"}"
        </span>
        {tag.slots.map((s, i) => (
          <SlotPill key={i} slot={s} />
        ))}
        <span className="text-muted">]</span>
        <span className="flex gap-1 ml-1 font-sans">
          {required && <Badge tone="warn" title="The event must carry this tag">required</Badge>}
          {multiple && <Badge title="May appear more than once">repeatable</Badge>}
          {tag.prefix && <Badge title="Matches any tag name starting with this">prefix</Badge>}
        </span>
      </div>
      {tag.description && <p className="mt-1 text-xs text-muted">{tag.description}</p>}
    </div>
  );
}

// A NIP's markdown, rendered. Links between NIPs (`17.md`, `01.md#tags`) move
// inside the app, in-page anchors scroll, and anything else opens in the
// system browser — the webview itself never navigates away.

import { memo, type ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { openUrl } from "@tauri-apps/plugin-opener";

const NIP_HREF = /^(?:\.\/)?([0-9A-Z]{2})\.md(?:#(.*))?$/;

function plain(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(plain).join("");
  if (node && typeof node === "object" && "props" in node)
    return plain((node as { props: { children?: ReactNode } }).props.children);
  return "";
}

/** GitHub's heading anchors, near enough for the links NIPs actually use. */
function slug(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s/g, "-");
}

export function scrollToAnchor(root: HTMLElement | null, anchor: string) {
  if (!root) return;
  let id = anchor;
  try {
    id = decodeURIComponent(anchor);
  } catch {
    /* use as written */
  }
  root.querySelector(`[id="${CSS.escape(id.toLowerCase())}"]`)?.scrollIntoView({ block: "start" });
}

function heading(Tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6") {
  return function Heading({ children }: { children?: ReactNode }) {
    return <Tag id={slug(plain(children))}>{children}</Tag>;
  };
}

export const NipDoc = memo(function NipDoc({
  text,
  hasNip,
  onNip,
  onAnchor,
}: {
  text: string;
  hasNip: (id: string) => boolean;
  onNip: (id: string, anchor?: string) => void;
  onAnchor: (anchor: string) => void;
}) {
  return (
    <div className="nip-doc">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: heading("h1"),
          h2: heading("h2"),
          h3: heading("h3"),
          h4: heading("h4"),
          h5: heading("h5"),
          h6: heading("h6"),
          a({ href, children }) {
            const h = href ?? "";
            const nip = h.match(NIP_HREF);
            const internal = nip && hasNip(nip[1]);
            return (
              <a
                className={internal ? "nip-link" : undefined}
                title={internal ? `NIP-${nip[1]}` : h}
                onClick={(e) => {
                  e.preventDefault();
                  if (internal) onNip(nip[1], nip[2]);
                  else if (h.startsWith("#")) onAnchor(h.slice(1));
                  else if (/^(https?:|mailto:)/.test(h)) void openUrl(h);
                }}
              >
                {children}
              </a>
            );
          },
          // A relative image would resolve against the app's own origin and
          // a remote one would make the reader phone out; show the alt text.
          img({ alt }) {
            return <span className="text-muted">[image{alt ? `: ${alt}` : ""}]</span>;
          },
        }}
      >
        {text}
      </Markdown>
    </div>
  );
});

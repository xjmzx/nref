# nref — notes for Claude

Reference browser for Nostr event kinds and NIPs. Tauri 2 · React. Scaffolded
from `nping`. See [`README.md`](README.md).

## Read SUITE.md first

[`../ndisc/SUITE.md`](https://github.com/xjmzx/ndisc/blob/main/SUITE.md) is
authoritative for anything shared across the suite (top-bar grammar, themes,
build conventions, platform traps).

## Build and verify

```
make dev      # hot reload
make check    # npm run build (tsc + vite) + cargo check
make build    # release
```

Release path is `tauri build`, which runs Vite. **Never `cargo build --release`**.

## How it is put together

- **Rust reads, the webview parses.** `src-tauri/src/lib.rs` has three
  commands: `load` (both checkouts as raw text + each repo's HEAD), `pull`
  (`git pull --ff-only`) and `pick_path` (native folder dialog). All parsing —
  YAML, the README tables, NIP headers, cross-links — is in `src/lib/data.ts`.
  Keep it that way: the raw files are the only source, nothing is cached.
- **A kind has three possible sources** and records which it came from:
  `schema.yaml`, the README's *Event Kinds* table, and `src/lib/suite.ts`. The
  first two overlap without either containing the other; that gap is a feature
  the UI shows, not noise to hide.
- **`src/lib/suite.ts` mirrors SUITE.md's wire-contract table by hand.** When
  the contract changes there, change it here.
- **Use js-yaml, not `yaml`.** schema.yaml is built on aliases, and the `yaml`
  package refuses a document past 100 of them by default.
- **`pull` is fast-forward only, on purpose.** These are the user's working
  checkouts; never merge, rebase, reset or stash from the app.

## Traps

- **No keys, no relays, no database**, and it should stay that way.
- **The webview must never navigate.** Every link in a rendered NIP goes
  through `NipDoc`'s `a` override: NIP links move inside the app, anchors
  scroll, the rest go to `openUrl`. Images are replaced by their alt text so
  reading a spec makes no network request.
- **`icon.svg` is a placeholder** (the `n` on the tile, cut from nping's
  master). Replace it with a Figma master and run `make icons`.
- Debug builds use `nref.dev.json`, so `make dev` never re-points the
  installed app's checkouts.

## Not here

Machine-local paths belong in a machine-local `CLAUDE.md`. The only path in
the source is the default `~/code/nostr/<repo>`.

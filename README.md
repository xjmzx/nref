# nref

A searchable reference for Nostr **event kinds** and **NIPs**, read straight
from two git checkouts you already have. Part of the n-suite (Tauri 2 · React).

| Section | Source |
|---|---|
| **Kinds** | [`registry-of-kinds`](https://github.com/nostr-protocol/registry-of-kinds)' `schema.yaml`, merged with the *Event Kinds* table in the NIPs README |
| **NIPs** | [`nips`](https://github.com/nostr-protocol/nips)' `01.md … 99.md` and the lettered `5A.md`, `EE.md`, … |

- **Kinds** — search by number, name, tag or NIP; filter by class (regular /
  replaceable / ephemeral / addressable), by which source lists the kind, by
  `in_use`, or to the kinds the n-suite itself uses. Each kind shows its tag
  grammar as the arrays it describes — `["e", <id>, <relay>?, reply | root?, <pubkey>?]`
  — with required and repeatable tags marked.
- **NIPs** — full-text search, filter by series and status, and read the spec
  rendered in the app. Links between NIPs stay inside the app.
- **Cross-links** — a kind links to the NIP that defines it and to every NIP
  that mentions it; a NIP lists its kinds.
- The footer shows which commit of each checkout you are looking at; **pull**
  runs `git pull --ff-only` in both.

Nothing is cached, stored or sent anywhere: no keys, no relays, no database.

## Setup

```
git clone https://github.com/nostr-protocol/nips ~/code/nostr/nips
git clone https://github.com/nostr-protocol/registry-of-kinds ~/code/nostr/registry-of-kinds
```

Those are the default locations. Checkouts elsewhere: click the repo's name in
the footer and pick the folder.

```
make deps     # once
make dev      # hot reload
make check    # typecheck + cargo check
make install  # Linux: binary + .desktop under ~/.local
```

## Keys

`/` or `Ctrl+K` search · `↑` `↓` move through results · `1` / `2` switch section ·
`Alt+←` back · click the wordmark to cycle the theme.

# Changelog

No wire contract: nref reads the public NIPs and kind registry and publishes
nothing.

## 0.1.2 — 2026-11-24

### Added — update check on the version chip

The chip checks GitHub once a day for a newer published release (pre-release
tags never count). When one exists, a dot appears on the chip's corner;
clicking the chip opens a popover with the status, a link to the release page,
**Check now**, and a **Check daily** switch to turn it off. Notify-only:
nothing is downloaded or installed. Vendored from ndisc
(`src/lib/updateCheck.ts`, `src/components/VersionChip.tsx`,
`src/components/TickBox.tsx`); only `APP_REPO` differs.

## 0.1.1 — 2026-10-03

- The n-suite kinds list now mirrors SUITE.md: adds 4550 (NIP-72 sign-off)
  and 4 (legacy NIP-04, read-only in nchat), and names each kind's
  publishers and readers.

## 0.1.0 — 2026-10-03

- Kinds section: `registry-of-kinds/schema.yaml` merged with the NIPs README
  kind table; search, class/source/in-use/n-suite filters, tag-shape viewer.
- NIPs section: full-text search, series and status filters, rendered reader
  with in-app links between NIPs.
- Kind ↔ NIP cross-links with a shared back-stack.
- Reads two local git checkouts; `pull` fast-forwards both.
- Release workflow: .deb, .dmg and Windows installer on `v*` tags.

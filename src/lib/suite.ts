// The kinds the n-suite itself puts on the wire, so the reference can mark
// them and show whether the public registry knows each one. Mirrors
// ndisc/SUITE.md: the wire-contract table, the media and messaging paragraphs
// under it and the remote-signer section. That document is the authority; update this
// list when it changes.

export interface SuiteUse {
  /** Contract or role name. */
  role: string;
  apps: string;
}

export const SUITE_KINDS: Record<number, SuiteUse> = {
  // The catalogue spine.
  31237: { role: "release.v2 — a release", apps: "ndisc publishes · nview, glmps read" },
  31238: { role: "labels.v1 — record-label registry", apps: "ndisc publishes · nview, glmps read" },
  31239: { role: "feed.v1 — feed-note channel", apps: "ndisc publishes · nplay, nview, ntree, nsmpl read" },
  30000: { role: "contributor registry (NIP-51 list)", apps: "ndisc publishes · all read" },
  4550: { role: "per-note sign-off (NIP-72)", apps: "ndisc" },
  7: { role: "reactions / ratings (NIP-25)", apps: "ndisc, ntree, nsmpl, nview publish · all read" },
  1063: { role: "clip.v1 — clip / sample file metadata (NIP-94)", apps: "ntree (clips), nsmpl (samples)" },
  // Media, beside the spine (Blossom).
  10063: { role: "Blossom server list (BUD-03)", apps: "ndisc publishes" },
  24242: { role: "Blossom upload authorization — HTTP header, never sent to a relay", apps: "ndisc" },
  // Messaging, outside the spine.
  1059: { role: "NIP-17 gift wrap", apps: "nchat" },
  13: { role: "NIP-17 seal", apps: "nchat" },
  14: { role: "NIP-17 rumor (private DM)", apps: "nchat" },
  4: { role: "legacy NIP-04 DM — read, never written", apps: "nchat" },
  // The remote signer.
  24133: { role: "NIP-46 remote signing (app ⇄ signer)", apps: "nsign · nview, glmps logins" },
};

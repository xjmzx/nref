// The kinds the n-suite itself puts on the wire, so the reference can mark
// them and show whether the public registry knows each one. Mirrors the wire
// contract table in ndisc/SUITE.md — that document is the authority; update
// this list when it changes.

export interface SuiteUse {
  /** Contract or role name. */
  role: string;
  apps: string;
}

export const SUITE_KINDS: Record<number, SuiteUse> = {
  7: { role: "reactions on releases", apps: "glmps · nview" },
  13: { role: "NIP-17 seal", apps: "nchat" },
  14: { role: "NIP-17 rumor (private DM)", apps: "nchat" },
  1059: { role: "NIP-17 gift wrap", apps: "nchat" },
  1063: { role: "clip / sample file metadata", apps: "ntree · nsmpl" },
  24133: { role: "NIP-46 remote signing", apps: "nview · nsign" },
  30000: { role: "contributors", apps: "ndisc" },
  31237: { role: "release.v2 — addressable release", apps: "ndisc (publisher) · nview · glmps" },
  31238: { role: "labels", apps: "ndisc" },
  31239: { role: "feed.v1", apps: "ndisc (publisher) · nplay" },
};

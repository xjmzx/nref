// The whole IPC surface. Rust finds the two checkouts, reads them as text and
// runs git; everything else happens here.

import { invoke } from "@tauri-apps/api/core";

export type Which = "nips" | "kinds";

export interface RepoState {
  path: string;
  exists: boolean;
  isGit: boolean;
  head: string | null;
  date: string | null;
  subject: string | null;
  branch: string | null;
  remote: string | null;
}

export interface Loaded {
  nips: RepoState;
  kinds: RepoState;
  nipFiles: { id: string; text: string }[];
  readme: string | null;
  schema: string | null;
}

export function load(): Promise<Loaded> {
  return invoke("load");
}

/** `git pull --ff-only`; resolves with git's output, rejects with its error. */
export function pull(which: Which): Promise<string> {
  return invoke("pull", { which });
}

/** Native folder picker; resolves false if cancelled. */
export function pickPath(which: Which): Promise<boolean> {
  return invoke("pick_path", { which });
}

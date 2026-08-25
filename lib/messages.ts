import type { Tree } from "./types";

export interface FetchTreeRequest { type: "fetchTree"; repo: string; pr: number }
export type FetchTreeResponse =
  | { ok: true; tree: Tree; label: string; ids: Record<number, string> }
  | { ok: false; error: string };

/** Server-side rebase of PRs in order (each onto its current base). */
export interface RebaseRequest { type: "rebase"; ids: string[] }
export type RebaseResponse = { ok: true } | { ok: false; error: string; failedAt?: string };

export type Request = FetchTreeRequest | RebaseRequest;

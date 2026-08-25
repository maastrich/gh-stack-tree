import type { Tree } from "./types";

export interface FetchTreeRequest { type: "fetchTree"; repo: string; pr: number }
export type FetchTreeResponse =
  | { ok: true; tree: Tree; label: string; ids: Record<number, string> }
  | { ok: false; error: string };

export interface FetchTreeByLabelRequest { type: "fetchTreeByLabel"; repo: string; label: string }

/** Server-side rebase of PRs in order (each onto its current base). */
export interface RebaseRequest { type: "rebase"; ids: string[] }
export type RebaseResponse = { ok: true } | { ok: false; error: string; failedAt?: string };

/** Info needed to put an unlabeled PR into a stack. */
export interface StackOptionsRequest { type: "stackOptions"; repo: string; pr: number }
export type StackOptionsResponse =
  | { ok: true; prId: string; base: string; parentLabel: string | null; labels: string[] }
  | { ok: false; error: string };

export interface SetStackLabelRequest { type: "setStackLabel"; repo: string; prId: string; label: string }
export interface RemoveStackLabelRequest { type: "removeStackLabel"; repo: string; prId: string; label: string }
export type SimpleResponse = { ok: true } | { ok: false; error: string };

export type Request =
  | FetchTreeRequest | FetchTreeByLabelRequest | RebaseRequest
  | StackOptionsRequest | SetStackLabelRequest | RemoveStackLabelRequest;

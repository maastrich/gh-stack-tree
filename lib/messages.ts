import type { Tree } from "./types";

export interface FetchTreeRequest {
  type: "fetchTree";
  repo: string;
  pr: number;
}
export type FetchTreeResponse =
  | { ok: true; tree: Tree; label: string }
  | { ok: false; error: string };

import type { Tree } from "./types";

export const START = "<!-- gh-stack-tree:start";
export const END = "gh-stack-tree:end -->";

/**
 * Extract the tree JSON embedded in a PR body.
 * Format:
 *   <!-- gh-stack-tree:start
 *   {"trunk":"main","nodes":[...]}
 *   gh-stack-tree:end -->
 */
export function parseTree(body: string): Tree | null {
  const s = body.indexOf(START);
  if (s === -1) return null;
  const e = body.indexOf(END, s);
  if (e === -1) return null;
  const raw = body.slice(s + START.length, e).trim();
  try {
    const t = JSON.parse(raw) as Tree;
    if (!t || !Array.isArray(t.nodes) || typeof t.trunk !== "string") return null;
    return t;
  } catch {
    return null;
  }
}

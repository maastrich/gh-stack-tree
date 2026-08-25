import type { Tree, TreeNode } from "./types";

export const LABEL_PREFIX = "stacktree:";

export interface PRInfo {
  number: number;
  head: string;
  base: string;
  title?: string;
  merged?: boolean;
  draft?: boolean;
}

export function stackLabel(labels: string[]): string | null {
  return labels.find((l) => l.startsWith(LABEL_PREFIX)) ?? null;
}

/**
 * Build a tree from PRs sharing a stack label, using base <- head branch
 * relations. A PR whose base is not another PR's head is a root; the trunk is
 * the most common root base.
 */
export function inferTree(prs: PRInfo[]): Tree {
  const byHead = new Map(prs.map((p) => [p.head, p]));
  const nodes: TreeNode[] = [];
  const rootBases = new Map<string, number>();
  for (const p of prs) {
    const parent = byHead.get(p.base);
    if (!parent) rootBases.set(p.base, (rootBases.get(p.base) ?? 0) + 1);
    nodes.push({
      pr: p.number,
      branch: p.head,
      parent: parent ? parent.number : null,
      title: p.title,
      merged: p.merged,
      draft: p.draft,
    });
  }
  let trunk = "";
  let best = -1;
  for (const [base, n] of rootBases) if (n > best) ((best = n), (trunk = base));
  nodes.sort((a, b) => a.pr - b.pr);
  return { trunk, nodes };
}

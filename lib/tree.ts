import type { Tree, TreeNode } from "./types";

export interface Row {
  node: TreeNode;
  depth: number;
  /** For each ancestor level: does a vertical line continue below? */
  guides: boolean[];
  isLast: boolean;
}

/** Flatten tree to DFS preorder rows with box-drawing guide info. */
export function flatten(tree: Tree): Row[] {
  const byParent = new Map<number | null, TreeNode[]>();
  for (const n of tree.nodes) {
    const list = byParent.get(n.parent) ?? [];
    list.push(n);
    byParent.set(n.parent, list);
  }
  const rows: Row[] = [];
  const walk = (parent: number | null, depth: number, guides: boolean[]) => {
    const kids = byParent.get(parent) ?? [];
    kids.forEach((node, i) => {
      const isLast = i === kids.length - 1;
      rows.push({ node, depth, guides, isLast });
      walk(node.pr, depth + 1, [...guides, !isLast]);
    });
  };
  walk(null, 0, []);
  return rows;
}

export function prefix(row: Row): string {
  const g = row.guides.map((cont) => (cont ? "│  " : "   ")).join("");
  return g + (row.isLast ? "└─ " : "├─ ");
}

/** Path from trunk to `pr`, trunk-side first. */
export function pathTo(tree: Tree, pr: number): TreeNode[] {
  const byPr = new Map(tree.nodes.map((n) => [n.pr, n]));
  const out: TreeNode[] = [];
  let cur = byPr.get(pr);
  while (cur) {
    out.unshift(cur);
    cur = cur.parent === null ? undefined : byPr.get(cur.parent);
  }
  return out;
}

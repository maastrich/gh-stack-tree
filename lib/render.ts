import type { Tree } from "./types";
import { flatten, pathTo, prefix } from "./tree";

export const PANEL_ID = "gh-stack-tree-panel";

export function renderPanel(tree: Tree, currentPr: number, repo: string): HTMLElement {
  const onPath = new Set(pathTo(tree, currentPr).map((n) => n.pr));
  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.className = "discussion-sidebar-item";

  const heading = document.createElement("div");
  heading.className = "text-bold";
  heading.textContent = "Stack tree";
  panel.append(heading);

  const pre = document.createElement("pre");
  pre.style.cssText = "font-size:12px;line-height:1.5;margin:4px 0 0;overflow-x:auto";

  const trunk = document.createElement("div");
  trunk.textContent = `(${tree.trunk})`;
  pre.append(trunk);

  for (const row of flatten(tree)) {
    const line = document.createElement("div");
    const { node } = row;
    const isCurrent = node.pr === currentPr;
    line.style.opacity = onPath.has(node.pr) ? "1" : "0.55";
    if (isCurrent) line.style.fontWeight = "bold";

    const guide = document.createElement("span");
    guide.style.color = "var(--fgColor-muted)";
    guide.textContent = prefix(row);

    const a = document.createElement("a");
    a.href = `/${repo}/pull/${node.pr}`;
    a.textContent = `#${node.pr} ${node.branch}`;
    a.style.color = node.merged ? "var(--fgColor-done)" : "var(--fgColor-accent)";

    line.append(guide, a);
    if (node.merged) line.append(document.createTextNode(" ✓"));
    if (isCurrent) line.append(document.createTextNode(" ◀"));
    pre.append(line);
  }
  panel.append(pre);
  return panel;
}

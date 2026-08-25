import type { Tree } from "./types";

export const LANG = "gh-stack-tree";

/**
 * Parse tree JSON from raw markdown containing a fenced block:
 *   ```gh-stack-tree
 *   {"trunk":"main","nodes":[...]}
 *   ```
 */
export function parseTree(markdown: string): Tree | null {
  const re = new RegExp("```" + LANG + "\\s*\\n([\\s\\S]*?)\\n```");
  const m = markdown.match(re);
  return m ? parseJSON(m[1]!) : null;
}

/** Find the rendered fenced block inside a GitHub markdown body element. */
export function findTreeBlock(root: ParentNode): HTMLElement | null {
  return root.querySelector<HTMLElement>(
    `pre > code.language-${LANG}, pre[lang="${LANG}"] > code, div.highlight-source-${LANG} pre`,
  );
}

/** Parse tree from a rendered GitHub body element. */
export function parseTreeFromDOM(root: ParentNode): Tree | null {
  const code = findTreeBlock(root);
  return code ? parseJSON(code.textContent ?? "") : null;
}

export function serializeTree(tree: Tree): string {
  return "```" + LANG + "\n" + JSON.stringify(tree) + "\n```";
}

function parseJSON(raw: string): Tree | null {
  try {
    const t = JSON.parse(raw.trim()) as Tree;
    if (!t || !Array.isArray(t.nodes) || typeof t.trunk !== "string") return null;
    return t;
  } catch {
    return null;
  }
}

import type { Tree, TreeNode } from "./types";
import { flatten, pathTo, subtree } from "./tree";

function cell(cls: string): HTMLElement {
  const i = document.createElement("i");
  i.className = cls;
  return i;
}

export const PANEL_ID = "gh-stack-tree-panel";
export const PILL_ID = "gh-stack-tree-pill";
export type RebaseFn = (scope: "subtree" | "tree") => Promise<string | null>;

const ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3 2.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm7 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM3 13.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM4.5 4a.75.75 0 0 1 .75.75v2.5c0 .69.56 1.25 1.25 1.25h3a2.75 2.75 0 0 0 2.75-2.75V4.75a.75.75 0 0 1 1.5 0v1a4.25 4.25 0 0 1-4.25 4.25h-3c-.45 0-.87-.11-1.25-.3v1.55a.75.75 0 0 1-1.5 0v-6.5A.75.75 0 0 1 4.5 4Z"/></svg>`;

const css = `
.gst-card{border:1px solid var(--borderColor-default);border-radius:6px;margin-bottom:16px;background:var(--bgColor-default);font-size:12px}
.gst-card .hd{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--borderColor-muted);background:var(--bgColor-muted);border-radius:6px 6px 0 0;font-weight:600;font-size:13px}
.gst-card .hd .n{color:var(--fgColor-muted);font-weight:400}
.gst-card .row{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto auto;align-items:center;gap:0 10px;padding:6px 12px;border-bottom:1px solid var(--borderColor-muted)}
.gst-card .row:last-child{border-bottom:0}
.gst-card .row.cur{background:var(--bgColor-accent-muted)}
.gst-card .row.off{opacity:.55}
.gst-card .g{display:flex;align-self:stretch;margin:-6px 0}
.gst-card .g i{display:block;width:16px;position:relative}
.gst-card .g i.v::before{content:"";position:absolute;left:7px;top:0;bottom:0;border-left:2px solid var(--borderColor-default)}
.gst-card .g i.c::before{content:"";position:absolute;left:7px;top:0;height:50%;border-left:2px solid var(--borderColor-default)}
.gst-card .g i.c::after{content:"";position:absolute;left:7px;top:50%;width:9px;border-top:2px solid var(--borderColor-default)}
.gst-card .g i.c.v::before{height:100%}
.gst-card .t{min-width:0;display:flex;flex-direction:column;gap:1px}
.gst-card .t a{font-weight:600;color:var(--fgColor-default);text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gst-card .t a:hover{color:var(--fgColor-accent)}
.gst-card .t .b{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--fgColor-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gst-card .d{font-family:ui-monospace,monospace;white-space:nowrap}
.gst-card .d .a{color:var(--fgColor-success)} .gst-card .d .r{color:var(--fgColor-danger)}
.gst-card .s{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
.gst-card .dot{width:8px;height:8px;border-radius:50%;display:inline-block}
.gst-card .lbl{padding:0 6px;border-radius:10px;font-weight:500;line-height:18px;border:1px solid transparent;white-space:nowrap}
.gst-card .trunk{padding:6px 12px;color:var(--fgColor-muted);font-family:ui-monospace,monospace;border-bottom:1px solid var(--borderColor-muted)}
.gst-card .ft{display:flex;gap:8px;padding:8px 12px;border-top:1px solid var(--borderColor-muted);align-items:center}
.gst-card .ft .msg{color:var(--fgColor-danger);font-size:12px;margin-left:auto}
.gst-btn{font:inherit;font-size:12px;font-weight:500;padding:3px 10px;border-radius:6px;border:1px solid var(--button-default-borderColor-rest);background:var(--button-default-bgColor-rest);color:var(--button-default-fgColor-rest);cursor:pointer}
.gst-btn:hover{background:var(--button-default-bgColor-hover)}
.gst-btn:disabled{opacity:.6;cursor:default}
.${PILL_ID}{display:inline-flex;align-items:center;gap:4px;margin-left:8px;padding:0 10px;height:28px;border-radius:2em;border:1px solid var(--borderColor-default);color:var(--fgColor-default);font-size:14px;font-weight:500;cursor:pointer;background:transparent;vertical-align:middle;position:relative}
.${PILL_ID}:hover{background:var(--bgColor-muted)}
.gst-mono{font-variant-numeric:tabular-nums}
.gst-pop{position:absolute;top:calc(100% + 6px);left:0;z-index:100;width:min(520px,90vw);box-shadow:var(--shadow-floating-large,0 8px 24px rgba(0,0,0,.4));text-align:left;font-weight:400;cursor:default}
`;

let styleInjected = false;
function ensureStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
}

function state(n: TreeNode): { text: string; cls: string; bg: string } {
  if (n.merged) return { text: "Merged", cls: "done", bg: "var(--bgColor-done-emphasis)" };
  if (n.draft) return { text: "Draft", cls: "muted", bg: "var(--bgColor-neutral-emphasis)" };
  if (n.behind) return { text: "Conflicts", cls: "danger", bg: "var(--bgColor-danger-emphasis)" };
  if (n.review === "APPROVED") return { text: "Approved", cls: "success", bg: "var(--bgColor-success-emphasis)" };
  if (n.review === "CHANGES_REQUESTED") return { text: "Changes requested", cls: "danger", bg: "var(--bgColor-danger-emphasis)" };
  return { text: "Open", cls: "open", bg: "var(--bgColor-open-emphasis)" };
}

function ci(n: TreeNode): { color: string; title: string } | null {
  switch (n.ci) {
    case "SUCCESS": return { color: "var(--fgColor-success)", title: "Checks passed" };
    case "FAILURE": case "ERROR": return { color: "var(--fgColor-danger)", title: "Checks failed" };
    case "PENDING": case "EXPECTED": return { color: "var(--fgColor-attention)", title: "Checks pending" };
    default: return null;
  }
}

export function renderPill(tree: Tree, currentPr: number, repo: string, label: string | undefined, onRebase: RebaseFn): HTMLElement {
  ensureStyle();
  const below = pathTo(tree, currentPr).length - 1; // ancestors (toward trunk)
  const above = subtree(tree, currentPr).length - 1; // descendants
  const pill = document.createElement("button");
  pill.className = PILL_ID;
  pill.type = "button";
  pill.innerHTML = `${ICON}<span class="gst-mono">↓${below} ↑${above}</span>`;
  pill.title = `Stack tree: ${below} PR${below === 1 ? "" : "s"} below (must merge first), ${above} PR${above === 1 ? "" : "s"} above (depend on this one)`;
  let pop: HTMLElement | null = null;
  const close = () => { pop?.remove(); pop = null; document.removeEventListener("click", onDoc, true); };
  const onDoc = (e: Event) => { if (pop && !pill.contains(e.target as Node)) close(); };
  pill.addEventListener("click", (e) => {
    if (pop) { if (e.target === pill || (e.target as HTMLElement).closest("span")?.parentElement === pill) close(); return; }
    pop = renderCard(tree, currentPr, repo, label, onRebase);
    pop.classList.add("gst-pop");
    pop.addEventListener("click", (ev) => ev.stopPropagation());
    pill.append(pop);
    setTimeout(() => document.addEventListener("click", onDoc, true));
  });
  return pill;
}

export function renderPanel(tree: Tree, currentPr: number, repo: string, label: string | undefined, onRebase: RebaseFn): HTMLElement {
  ensureStyle();
  const panel = renderCard(tree, currentPr, repo, label, onRebase);
  panel.id = PANEL_ID;
  return panel;
}

export interface CardOpts {
  /** Extra element(s) for the header's right side. */
  headerExtra?: HTMLElement[];
  /** Omit the rebase footer. */
  noFooter?: boolean;
}

export function renderCard(tree: Tree, currentPr: number | null, repo: string, label: string | undefined, onRebase: RebaseFn | null, opts: CardOpts = {}): HTMLElement {
  ensureStyle();
  // With no current PR nothing is dimmed.
  const onPath = currentPr === null ? new Set(tree.nodes.map((n) => n.pr)) : new Set(pathTo(tree, currentPr).map((n) => n.pr));
  const panel = document.createElement("div");
  panel.className = "gst-card";

  const hd = document.createElement("div");
  hd.className = "hd";
  hd.innerHTML = ICON;
  const ht = document.createElement("span");
  ht.textContent = "Stack tree";
  hd.append(ht);
  if (label) {
    const n = document.createElement("span");
    n.className = "n";
    n.textContent = label.replace(/^stacktree:/, "");
    hd.append(n);
  }
  const cnt = document.createElement("span");
  cnt.className = "n";
  cnt.style.marginLeft = "auto";
  cnt.textContent = `${tree.nodes.length} PRs`;
  hd.append(cnt);
  for (const e of opts.headerExtra ?? []) hd.append(e);
  panel.append(hd);

  const trunk = document.createElement("div");
  trunk.className = "trunk";
  trunk.textContent = tree.trunk;
  panel.append(trunk);

  for (const row of flatten(tree)) {
    const { node } = row;
    const isCur = node.pr === currentPr;
    const el = document.createElement("div");
    el.className = "row" + (isCur ? " cur" : "") + (onPath.has(node.pr) ? "" : " off");

    const g = document.createElement("span");
    g.className = "g";
    for (const cont of row.guides) g.append(cell(cont ? "v" : ""));
    g.append(cell(row.isLast ? "c" : "c v"));

    const t = document.createElement("div");
    t.className = "t";
    const a = document.createElement("a");
    a.href = `/${repo}/pull/${node.pr}`;
    a.textContent = `#${node.pr} ${node.title ?? node.branch}`;
    const b = document.createElement("span");
    b.className = "b";
    b.textContent = node.branch;
    t.append(a, b);

    const d = document.createElement("span");
    d.className = "d";
    if (node.additions != null) d.innerHTML = `<span class="a">+${node.additions}</span> <span class="r">−${node.deletions ?? 0}</span>`;

    const c = document.createElement("span");
    c.className = "s";
    const cs = ci(node);
    if (cs) { c.innerHTML = `<span class="dot" style="background:${cs.color}"></span>`; c.title = cs.title; }

    const st = state(node);
    const l = document.createElement("span");
    l.className = "lbl";
    l.textContent = st.text;
    l.style.background = st.bg;
    l.style.color = "var(--fgColor-onEmphasis)";

    el.append(g, t, d, c, l);
    panel.append(el);
  }

  if (opts.noFooter || !onRebase) return panel;

  const ft = document.createElement("div");
  ft.className = "ft";
  const msg = document.createElement("span");
  msg.className = "msg";
  const mk = (text: string, scope: "subtree" | "tree") => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "gst-btn";
    b.textContent = text;
    b.addEventListener("click", async () => {
      const n = scope === "tree" ? tree.nodes.filter((x) => !x.merged).length : null;
      if (!confirm(`Rebase ${scope === "tree" ? `all ${n} PRs of the tree` : "this PR and everything below it"}?\nServer-side rebase + force-push, parents first.`)) return;
      for (const x of ft.querySelectorAll("button")) x.disabled = true;
      b.textContent = "Rebasing…";
      msg.textContent = "";
      const err = await onRebase(scope);
      if (err) { msg.textContent = err; for (const x of ft.querySelectorAll("button")) x.disabled = false; b.textContent = text; }
    });
    return b;
  };
  ft.append(mk("Rebase subtree", "subtree"), mk("Rebase tree", "tree"), msg);
  panel.append(ft);
  return panel;
}

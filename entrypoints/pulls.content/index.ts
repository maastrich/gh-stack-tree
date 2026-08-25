import { LABEL_PREFIX } from "@/lib/infer";
import type { FetchTreeByLabelRequest, FetchTreeResponse } from "@/lib/messages";
import { flatten } from "@/lib/tree";

const PULLS_RE = /^\/([^/]+\/[^/]+)\/pulls\/?$/;
const CLS = "gst-group";
let seq = 0;

export default defineContentScript({
  matches: ["https://github.com/*/*/pulls*"],
  runAt: "document_idle",
  main() {
    void run();
    document.addEventListener("turbo:load", () => void run());
  },
});

const css = `
.${CLS}-hd{display:flex;align-items:center;gap:8px;padding:8px 16px;background:var(--bgColor-muted);border-top:1px solid var(--borderColor-default);border-bottom:1px solid var(--borderColor-muted);font-size:12px;font-weight:600}
.${CLS}-hd .n{color:var(--fgColor-muted);font-weight:400;margin-left:auto}
.${CLS}-row{position:relative}
.${CLS}-g{position:absolute;left:0;top:0;bottom:0;display:flex;pointer-events:none}
.${CLS}-g i{display:block;width:16px;position:relative}
.${CLS}-g i.v::before{content:"";position:absolute;left:7px;top:0;bottom:0;border-left:2px solid var(--borderColor-default)}
.${CLS}-g i.c::before{content:"";position:absolute;left:7px;top:0;height:50%;border-left:2px solid var(--borderColor-default)}
.${CLS}-g i.c::after{content:"";position:absolute;left:7px;top:50%;width:9px;border-top:2px solid var(--borderColor-default)}
.${CLS}-g i.c.v::before{height:100%}
`;

interface RowInfo { pr: number; row: HTMLElement; label: string }

function findRows(repo: string): RowInfo[] {
  const out: RowInfo[] = [];
  const seen = new Set<HTMLElement>();
  for (const a of document.querySelectorAll<HTMLAnchorElement>(`a[href^="/${repo}/pull/"]`)) {
    const m = a.getAttribute("href")!.match(/\/pull\/(\d+)(?:$|[/?#])/);
    if (!m) continue;
    const row = a.closest<HTMLElement>("li, [role='listitem'], .js-issue-row");
    if (!row || seen.has(row)) continue;
    // Label chips may carry the label description in their text; take the token only.
    const lm = (row.textContent ?? "").match(new RegExp(LABEL_PREFIX + "[\\w.\\-/]+"));
    if (!lm) continue;
    seen.add(row);
    out.push({ pr: Number(m[1]), row, label: lm[0] });
  }
  return out;
}

async function run() {
  const m = location.pathname.match(PULLS_RE);
  if (!m) return;
  const repo = m[1]!;
  const mine = ++seq;

  if (!document.getElementById(CLS + "-style")) {
    const st = document.createElement("style");
    st.id = CLS + "-style";
    st.textContent = css;
    document.head.append(st);
  }

  const rows = findRows(repo);
  if (!rows.length) return;
  const byLabel = new Map<string, RowInfo[]>();
  for (const r of rows) byLabel.set(r.label, [...(byLabel.get(r.label) ?? []), r]);

  for (const [label, group] of byLabel) {
    const req: FetchTreeByLabelRequest = { type: "fetchTreeByLabel", repo, label };
    const res = (await browser.runtime.sendMessage(req)) as FetchTreeResponse;
    if (mine !== seq) return;
    if (!res.ok) { if (res.error !== "no token") console.warn("[gh-stack-tree]", res.error); continue; }

    const rowByPr = new Map(group.map((r) => [r.pr, r.row]));
    const first = group[0]!.row;
    const parent = first.parentElement!;

    // Group header inserted before the first row of this stack.
    const hd = document.createElement("div");
    hd.className = CLS + "-hd";
    hd.innerHTML = `<span>⧉ Stack tree</span><span>${label.slice(LABEL_PREFIX.length)}</span><span class="n">${res.tree.nodes.length} PRs · trunk ${res.tree.trunk}</span>`;
    parent.insertBefore(hd, first);

    // Reorder rows in DFS order under the header; rows not on this page are skipped.
    let cursor: Element = hd;
    for (const r of flatten(res.tree)) {
      const row = rowByPr.get(r.node.pr);
      if (!row) continue;
      row.classList.add(CLS + "-row");
      row.querySelector("." + CLS + "-g")?.remove();
      const g = document.createElement("span");
      g.className = CLS + "-g";
      for (const cont of r.guides) g.append(cell(cont ? "v" : ""));
      g.append(cell(r.isLast ? "c" : "c v"));
      row.prepend(g);
      row.style.paddingLeft = `${16 * (r.depth + 1) + 8}px`;
      cursor.after(row);
      cursor = row;
    }
  }
}

function cell(cls: string): HTMLElement {
  const i = document.createElement("i");
  i.className = cls;
  return i;
}

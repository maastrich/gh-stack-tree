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
.${CLS}-wrap{margin:8px 16px;border:1px solid var(--borderColor-default);border-radius:6px;overflow:hidden}
.${CLS}-hd{display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bgColor-muted);border-bottom:1px solid var(--borderColor-muted);font-weight:600;font-size:13px}
.${CLS}-hd .n{color:var(--fgColor-muted);font-weight:400}
.${CLS}-hd .n.r{margin-left:auto}
.${CLS}-trunk{padding:6px 12px;color:var(--fgColor-muted);font-family:ui-monospace,monospace;font-size:12px;border-bottom:1px solid var(--borderColor-muted)}
.${CLS}-flex{display:flex;align-items:stretch}
.${CLS}-flex > .${CLS}-g{align-self:stretch}
.${CLS}-row:last-child{border-bottom:0!important}
.${CLS}-g{display:flex;margin-right:4px}
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

    const wrap = document.createElement("div");
    wrap.className = CLS + "-wrap";
    const hd = document.createElement("div");
    hd.className = CLS + "-hd";
    hd.innerHTML = `${ICON}<span>Stack tree</span><span class="n">${label.slice(LABEL_PREFIX.length)}</span><span class="n r">${group.length} of ${res.tree.nodes.length} PRs</span>`;
    const trunk = document.createElement("div");
    trunk.className = CLS + "-trunk";
    trunk.textContent = res.tree.trunk;
    wrap.append(hd, trunk);
    parent.insertBefore(wrap, first);

    // Move rows into the wrapper in DFS order, with a guide column after the checkbox.
    for (const r of flatten(res.tree)) {
      const row = rowByPr.get(r.node.pr);
      if (!row) continue;
      row.classList.add(CLS + "-row");
      row.querySelector(":scope > ." + CLS + "-g")?.remove();
      const g = document.createElement("span");
      g.className = CLS + "-g";
      for (const cont of r.guides) g.append(cell(cont ? "v" : ""));
      g.append(cell(r.isLast ? "c" : "c v"));
      // Walk up from the title link to the block that sits beside the checkbox,
      // then insert the guide column just before it.
      const link = row.querySelector<HTMLElement>(`a[href^="/${repo}/pull/${r.node.pr}"]`);
      const checkbox = row.querySelector("input[type=checkbox]");
      let block: HTMLElement | null = link;
      while (block && block.parentElement && block.parentElement !== row && !(checkbox && block.contains(checkbox))) {
        const p: HTMLElement = block.parentElement;
        if (checkbox && p.contains(checkbox)) break;
        block = p;
      }
      if (block && block !== row && !(checkbox && block.contains(checkbox))) {
        block.before(g);
        (block.parentElement as HTMLElement).classList.add(CLS + "-flex");
      } else row.prepend(g);
      wrap.append(row);
    }
  }
}

const ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3 2.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm7 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM3 13.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM4.5 4a.75.75 0 0 1 .75.75v2.5c0 .69.56 1.25 1.25 1.25h3a2.75 2.75 0 0 0 2.75-2.75V4.75a.75.75 0 0 1 1.5 0v1a4.25 4.25 0 0 1-4.25 4.25h-3c-.45 0-.87-.11-1.25-.3v1.55a.75.75 0 0 1-1.5 0v-6.5A.75.75 0 0 1 4.5 4Z"/></svg>`;

function cell(cls: string): HTMLElement {
  const i = document.createElement("i");
  i.className = cls;
  return i;
}

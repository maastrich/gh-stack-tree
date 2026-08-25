import type { FetchTreeRequest, FetchTreeResponse, RebaseRequest, RebaseResponse, RemoveStackLabelRequest, SetStackLabelRequest, SimpleResponse, StackOptionsRequest, StackOptionsResponse } from "@/lib/messages";
import { PANEL_ID, PILL_ID, renderJoinPill, renderPanel, renderPill } from "@/lib/render";
import { subtree } from "@/lib/tree";
import type { Tree } from "@/lib/types";

const PR_RE = /^\/([^/]+\/[^/]+)\/pull\/(\d+)/;
let seq = 0;

export default defineContentScript({
  matches: ["https://github.com/*"],
  runAt: "document_idle",
  main() {
    void run();
    document.addEventListener("turbo:load", () => void run());
  },
});

async function run() {
  const m = location.pathname.match(PR_RE);
  if (!m) return;
  const repo = m[1]!;
  const pr = Number(m[2]!);
  const mine = ++seq;

  const req: FetchTreeRequest = { type: "fetchTree", repo, pr };
  const res = (await browser.runtime.sendMessage(req)) as FetchTreeResponse;
  if (mine !== seq) return;
  if (!res.ok) {
    if (res.error === "no stacktree label") await offerJoin(repo, pr);
    else if (res.error !== "no token") console.warn("[gh-stack-tree]", res.error);
    return;
  }

  hideNativeStackBanner();

  const onLeave = async (): Promise<string | null> => {
    const prId = res.ids[pr];
    if (!prId) return "PR id unknown";
    const req: RemoveStackLabelRequest = { type: "removeStackLabel", repo, prId, label: res.label };
    const r = (await browser.runtime.sendMessage(req)) as SimpleResponse;
    if (!r.ok) return r.error;
    location.reload();
    return null;
  };

  const onRebase = (scope: "subtree" | "tree") => rebase(res.tree, res.ids, scope === "subtree" ? pr : null);

  // Header pill next to the Open/Draft state badge, opens a popover with the tree.
  for (const el of document.querySelectorAll("." + PILL_ID)) el.remove();
  const badges = document.querySelectorAll(
    "[data-component='StateLabel'], .gh-header-meta .State",
  );
  for (const badge of badges) badge.after(renderPill(res.tree, pr, repo, res.label, onRebase));

  // Full card next to the merge box / CI checks.
  const mergeBox = document.querySelector(
    "[data-testid='mergebox-partial'], .merge-pr, .discussion-timeline-actions .merge-message, .discussion-timeline-actions",
  );
  document.getElementById(PANEL_ID)?.remove();
  if (mergeBox) mergeBox.before(renderPanel(res.tree, pr, repo, res.label, onRebase, { onLeave }));
}

async function offerJoin(repo: string, pr: number) {
  const req: StackOptionsRequest = { type: "stackOptions", repo, pr };
  const o = (await browser.runtime.sendMessage(req)) as StackOptionsResponse;
  if (!o.ok) { console.warn("[gh-stack-tree]", o.error); return; }
  const onJoin = async (label: string): Promise<string | null> => {
    const r = (await browser.runtime.sendMessage(
      { type: "setStackLabel", repo, prId: o.prId, label } satisfies SetStackLabelRequest,
    )) as SimpleResponse;
    if (!r.ok) return r.error;
    location.reload();
    return null;
  };
  for (const el of document.querySelectorAll("." + PILL_ID)) el.remove();
  for (const badge of document.querySelectorAll("[data-component='StateLabel'], .gh-header-meta .State"))
    badge.after(renderJoinPill({ base: o.base, parentLabel: o.parentLabel, labels: o.labels, onJoin }));
}

async function rebase(tree: Tree, ids: Record<number, string>, root: number | null): Promise<string | null> {
  const order = subtree(tree, root).filter((n) => !n.merged);
  const req: RebaseRequest = { type: "rebase", ids: order.map((n) => ids[n.pr]!) };
  const res = (await browser.runtime.sendMessage(req)) as RebaseResponse;
  if (!res.ok) return res.failedAt ? `#${res.failedAt}: ${res.error}` : res.error;
  location.reload();
  return null;
}

/** GitHub's "This pull request can be stacked… / Preview stack" suggestion banner. */
function hideNativeStackBanner() {
  const link = document.querySelector<HTMLElement>("a[href*='gh.io/stacks-overview']");
  const banner = link?.closest<HTMLElement>("section[data-component='Banner'], [aria-label='Can Stack Banner'], .flash");
  if (banner) banner.style.display = "none";
}

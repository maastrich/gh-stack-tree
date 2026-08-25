import type { FetchTreeRequest, FetchTreeResponse } from "@/lib/messages";
import { PANEL_ID, renderPanel } from "@/lib/render";

const PR_RE = /^\/([^/]+\/[^/]+)\/pull\/(\d+)/;

export default defineContentScript({
  matches: ["https://github.com/*"],
  runAt: "document_idle",
  main() {
    void run();
    // GitHub is a Turbo SPA; re-run on soft navigation.
    document.addEventListener("turbo:load", () => void run());
    document.addEventListener("turbo:render", () => void run());
  },
});

async function run() {
  const m = location.pathname.match(PR_RE);
  if (!m) return;
  const repo = m[1]!;
  const pr = Number(m[2]!);

  document.getElementById(PANEL_ID)?.remove();

  const req: FetchTreeRequest = { type: "fetchTree", repo, pr };
  const res = (await browser.runtime.sendMessage(req)) as FetchTreeResponse;
  if (!res.ok) {
    if (res.error !== "no token" && res.error !== "no stacktree label")
      console.warn("[gh-stack-tree]", res.error);
    return;
  }

  const sidebar = document.querySelector(
    "#partial-discussion-sidebar, [data-testid='issue-viewer-metadata-container']",
  );
  if (!sidebar) return;
  sidebar.prepend(renderPanel(res.tree, pr, repo, res.label));
}

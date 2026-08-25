import { findTreeBlock, parseTreeFromDOM } from "@/lib/markers";
import { PANEL_ID, renderPanel } from "@/lib/render";

const PR_RE = /^\/([^/]+\/[^/]+)\/pull\/(\d+)/;

export default defineContentScript({
  matches: ["https://github.com/*"],
  runAt: "document_idle",
  main() {
    run();
    // GitHub is a Turbo SPA; re-run on soft navigation.
    document.addEventListener("turbo:load", run);
    document.addEventListener("turbo:render", run);
  },
});

function run() {
  const m = location.pathname.match(PR_RE);
  if (!m) return;
  const repo = m[1]!;
  const pr = Number(m[2]!);

  document.getElementById(PANEL_ID)?.remove();

  const bodyEl = document.querySelector<HTMLElement>(
    ".js-comment-body, [data-testid='issue-body'] .markdown-body",
  );
  if (!bodyEl) return;
  const tree = parseTreeFromDOM(bodyEl);
  if (!tree) return;

  // Hide the raw block; the panel replaces it.
  const block = findTreeBlock(bodyEl);
  const wrapper = block?.closest<HTMLElement>("div.highlight, pre") ?? block;
  if (wrapper) wrapper.style.display = "none";

  const sidebar = document.querySelector(
    "#partial-discussion-sidebar, [data-testid='issue-viewer-metadata-container']",
  );
  if (!sidebar) return;
  sidebar.prepend(renderPanel(tree, pr, repo));
}

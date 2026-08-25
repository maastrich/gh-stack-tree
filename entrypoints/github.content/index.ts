import { parseTree } from "@/lib/markers";
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
  const prStr = m[2]!;
  const pr = Number(prStr);

  document.getElementById(PANEL_ID)?.remove();

  // First comment = PR body. Prefer raw markdown if a hidden textarea exists,
  // else fall back to the rendered comment's innerHTML (comments survive).
  const bodyEl = document.querySelector<HTMLElement>(
    ".js-comment-body, [data-testid='issue-body'] .markdown-body",
  );
  const body = bodyEl?.innerHTML ?? "";
  const tree = parseTree(body);
  if (!tree) return;

  const sidebar = document.querySelector(
    "#partial-discussion-sidebar, [data-testid='issue-viewer-metadata-container']",
  );
  if (!sidebar) return;
  sidebar.prepend(renderPanel(tree, pr, repo));
}

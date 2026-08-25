import { inferTree, stackLabel, type PRInfo } from "@/lib/infer";
import type { FetchTreeResponse, RebaseResponse, Request } from "@/lib/messages";
import { tokenItem } from "@/lib/storage";
import type { CIState, ReviewDecision } from "@/lib/types";

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(
    (msg: Request, _sender, sendResponse: (r: FetchTreeResponse | RebaseResponse) => void) => {
      const p =
        msg?.type === "fetchTree" ? fetchTree(msg.repo, msg.pr)
        : msg?.type === "rebase" ? rebase(msg.ids)
        : msg?.type === "fetchTreeByLabel" ? fetchTreeByLabel(msg.repo, msg.label)
        : null;
      if (!p) return;
      p.then(sendResponse).catch((e) => sendResponse({ ok: false, error: String(e) }));
      return true; // async
    },
  );
});

async function gql<T>(token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
  return json.data!;
}

const LABELS_Q = `query($owner:String!,$name:String!,$number:Int!){
  repository(owner:$owner,name:$name){ pullRequest(number:$number){ labels(first:50){ nodes{ name } } } } }`;

const PRS_Q = `query($owner:String!,$name:String!,$label:String!){
  repository(owner:$owner,name:$name){
    pullRequests(labels:[$label],first:100,states:[OPEN,MERGED],orderBy:{field:CREATED_AT,direction:ASC}){
      nodes{ id number title headRefName baseRefName merged isDraft additions deletions reviewDecision mergeable
        commits(last:1){ nodes{ commit{ statusCheckRollup{ state } } } } } } } }`;

async function fetchTree(repo: string, pr: number): Promise<FetchTreeResponse> {
  const token = await tokenItem.getValue();
  if (!token) return { ok: false, error: "no token" };
  const [owner, name] = repo.split("/") as [string, string];

  const labelsData = await gql<{ repository: { pullRequest: { labels: { nodes: { name: string }[] } } | null } }>(
    token, LABELS_Q, { owner, name, number: pr });
  const labels = labelsData.repository.pullRequest?.labels.nodes.map((l) => l.name) ?? [];
  const label = stackLabel(labels);
  if (!label) return { ok: false, error: "no stacktree label" };
  return fetchTreeByLabel(repo, label);
}

async function fetchTreeByLabel(repo: string, label: string): Promise<FetchTreeResponse> {
  const token = await tokenItem.getValue();
  if (!token) return { ok: false, error: "no token" };
  const [owner, name] = repo.split("/") as [string, string];

  const prsData = await gql<{ repository: { pullRequests: { nodes: {
    id: string; number: number; title: string; headRefName: string; baseRefName: string; merged: boolean; isDraft: boolean;
    additions: number; deletions: number; reviewDecision: ReviewDecision; mergeable: string;
    commits: { nodes: { commit: { statusCheckRollup: { state: CIState } | null } }[] } }[] } } }>(
    token, PRS_Q, { owner, name, label });
  const prs: PRInfo[] = prsData.repository.pullRequests.nodes.map((n) => ({
    id: n.id, number: n.number, head: n.headRefName, base: n.baseRefName, title: n.title, merged: n.merged, draft: n.isDraft,
    additions: n.additions, deletions: n.deletions, review: n.reviewDecision,
    ci: n.commits.nodes[0]?.commit.statusCheckRollup?.state ?? null,
    behind: n.mergeable === "CONFLICTING",
  }));
  const ids: Record<number, string> = {};
  for (const p of prs) ids[p.number] = p.id!;
  return { ok: true, tree: inferTree(prs), label, ids };
}

const REBASE_M = `mutation($id:ID!){ updatePullRequestBranch(input:{pullRequestId:$id,updateMethod:REBASE}){ pullRequest{ number } } }`;
const HEAD_Q = `query($id:ID!){ node(id:$id){ ... on PullRequest{ number headRefOid mergeable baseRef{ target{ oid } } } } }`;

/**
 * Rebase each PR onto its base, in the given order (parents first). GitHub
 * performs the rebase server-side asynchronously; we poll until the PR's head
 * moves (or is already up to date) before continuing to its children.
 */
async function rebase(ids: string[]): Promise<RebaseResponse> {
  const token = await tokenItem.getValue();
  if (!token) return { ok: false, error: "no token" };
  for (const id of ids) {
    const before = await gql<{ node: { number: number; headRefOid: string } }>(token, HEAD_Q, { id });
    try {
      await gql(token, REBASE_M, { id });
    } catch (e) {
      const msg = String(e);
      // "already up to date" style errors are fine; conflicts are not.
      if (/up to date|nothing to update/i.test(msg)) continue;
      return { ok: false, error: msg, failedAt: String(before.node.number) };
    }
    // Poll for the head to change (server-side async), max ~30s.
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const now = await gql<{ node: { headRefOid: string } }>(token, HEAD_Q, { id });
      if (now.node.headRefOid !== before.node.headRefOid) break;
    }
  }
  return { ok: true };
}

import { inferTree, stackLabel, type PRInfo } from "@/lib/infer";
import type { FetchTreeResponse, RebaseResponse, Request, SimpleResponse, StackOptionsResponse } from "@/lib/messages";
import { tokenItem } from "@/lib/storage";
import type { CIState, ReviewDecision } from "@/lib/types";

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(
    (msg: Request, _sender, sendResponse: (r: FetchTreeResponse | RebaseResponse | StackOptionsResponse | SimpleResponse) => void) => {
      const p =
        msg?.type === "fetchTree" ? fetchTree(msg.repo, msg.pr)
        : msg?.type === "rebase" ? rebase(msg.ids)
        : msg?.type === "fetchTreeByLabel" ? fetchTreeByLabel(msg.repo, msg.label)
        : msg?.type === "stackOptions" ? stackOptions(msg.repo, msg.pr)
        : msg?.type === "setStackLabel" ? setStackLabel(msg.repo, msg.prId, msg.label)
        : msg?.type === "removeStackLabel" ? removeStackLabel(msg.repo, msg.prId, msg.label)
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

const OPTIONS_Q = `query($owner:String!,$name:String!,$number:Int!){
  repository(owner:$owner,name:$name){
    id
    labels(first:50,query:"stacktree:"){ nodes{ name } }
    pullRequest(number:$number){ id baseRefName
      labels(first:50){ nodes{ name } } } } }`;
const PARENT_Q = `query($owner:String!,$name:String!,$head:String!){
  repository(owner:$owner,name:$name){
    pullRequests(headRefName:$head,states:[OPEN,MERGED],first:1,orderBy:{field:CREATED_AT,direction:DESC}){
      nodes{ labels(first:50){ nodes{ name } } } } } }`;
const LABEL_ID_Q = `query($owner:String!,$name:String!,$label:String!){
  repository(owner:$owner,name:$name){ id label(name:$label){ id } } }`;
const CREATE_LABEL_M = `mutation($repo:ID!,$name:String!,$color:String!,$desc:String){
  createLabel(input:{repositoryId:$repo,name:$name,color:$color,description:$desc}){ label{ id } } }`;
const ADD_LABEL_M = `mutation($id:ID!,$labels:[ID!]!){ addLabelsToLabelable(input:{labelableId:$id,labelIds:$labels}){ clientMutationId } }`;
const REMOVE_LABEL_M = `mutation($id:ID!,$labels:[ID!]!){ removeLabelsFromLabelable(input:{labelableId:$id,labelIds:$labels}){ clientMutationId } }`;

async function stackOptions(repo: string, pr: number): Promise<StackOptionsResponse> {
  const token = await tokenItem.getValue();
  if (!token) return { ok: false, error: "no token" };
  const [owner, name] = repo.split("/") as [string, string];
  const d = await gql<{ repository: { labels: { nodes: { name: string }[] };
    pullRequest: { id: string; baseRefName: string; labels: { nodes: { name: string }[] } } | null } }>(
    token, OPTIONS_Q, { owner, name, number: pr });
  if (!d.repository.pullRequest) return { ok: false, error: "PR not found" };
  const base = d.repository.pullRequest.baseRefName;
  const labels = d.repository.labels.nodes.map((l) => l.name).filter((l) => l.startsWith("stacktree:"));
  const pd = await gql<{ repository: { pullRequests: { nodes: { labels: { nodes: { name: string }[] } }[] } } }>(
    token, PARENT_Q, { owner, name, head: base });
  const parentLabel = stackLabel(pd.repository.pullRequests.nodes[0]?.labels.nodes.map((l) => l.name) ?? []);
  return { ok: true, prId: d.repository.pullRequest.id, base, parentLabel, labels };
}

async function labelId(token: string, repo: string, label: string, create: boolean): Promise<string> {
  const [owner, name] = repo.split("/") as [string, string];
  const d = await gql<{ repository: { id: string; label: { id: string } | null } }>(token, LABEL_ID_Q, { owner, name, label });
  if (d.repository.label) return d.repository.label.id;
  if (!create) throw new Error(`label ${label} not found`);
  const c = await gql<{ createLabel: { label: { id: string } } }>(token, CREATE_LABEL_M, {
    repo: d.repository.id, name: label, color: "0E8A16", desc: `PR stack tree: ${label.slice("stacktree:".length)}`,
  });
  return c.createLabel.label.id;
}

async function setStackLabel(repo: string, prId: string, label: string): Promise<SimpleResponse> {
  const token = await tokenItem.getValue();
  if (!token) return { ok: false, error: "no token" };
  const id = await labelId(token, repo, label, true);
  await gql(token, ADD_LABEL_M, { id: prId, labels: [id] });
  return { ok: true };
}

async function removeStackLabel(repo: string, prId: string, label: string): Promise<SimpleResponse> {
  const token = await tokenItem.getValue();
  if (!token) return { ok: false, error: "no token" };
  const id = await labelId(token, repo, label, false);
  await gql(token, REMOVE_LABEL_M, { id: prId, labels: [id] });
  return { ok: true };
}

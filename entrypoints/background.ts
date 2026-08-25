import { inferTree, stackLabel, type PRInfo } from "@/lib/infer";
import type { FetchTreeRequest, FetchTreeResponse } from "@/lib/messages";
import { tokenItem } from "@/lib/storage";

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(
    (msg: FetchTreeRequest, _sender, sendResponse: (r: FetchTreeResponse) => void) => {
      if (msg?.type !== "fetchTree") return;
      fetchTree(msg.repo, msg.pr)
        .then(sendResponse)
        .catch((e) => sendResponse({ ok: false, error: String(e) }));
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
      nodes{ number title headRefName baseRefName merged isDraft } } } }`;

async function fetchTree(repo: string, pr: number): Promise<FetchTreeResponse> {
  const token = await tokenItem.getValue();
  if (!token) return { ok: false, error: "no token" };
  const [owner, name] = repo.split("/") as [string, string];

  const labelsData = await gql<{ repository: { pullRequest: { labels: { nodes: { name: string }[] } } | null } }>(
    token, LABELS_Q, { owner, name, number: pr });
  const labels = labelsData.repository.pullRequest?.labels.nodes.map((l) => l.name) ?? [];
  const label = stackLabel(labels);
  if (!label) return { ok: false, error: "no stacktree label" };

  const prsData = await gql<{ repository: { pullRequests: { nodes: {
    number: number; title: string; headRefName: string; baseRefName: string; merged: boolean; isDraft: boolean }[] } } }>(
    token, PRS_Q, { owner, name, label });
  const prs: PRInfo[] = prsData.repository.pullRequests.nodes.map((n) => ({
    number: n.number, head: n.headRefName, base: n.baseRefName, title: n.title, merged: n.merged, draft: n.isDraft,
  }));
  return { ok: true, tree: inferTree(prs), label };
}

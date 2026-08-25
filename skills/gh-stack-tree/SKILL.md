---
name: gh-stack-tree
description: Create and maintain tree-shaped PR stacks on GitHub using plain git + gh and the `stacktree:<name>` label convention read by the gh-stack-tree browser extension. Use when asked to stack PRs, split a big change into dependent PRs, add a PR on top of another PR, rebase a stack, or merge a stack.
---

# gh-stack-tree

A stack tree is a set of PRs whose base branches form a tree rooted at trunk.
Membership is declared with one label per PR: `stacktree:<name>`. Parent/child
relations come from each PR's base branch — nothing else is stored.

## Conventions

- Label: `stacktree:<name>`, `<name>` = short kebab-case (`stacktree:lcm-agent`). One label per PR, one stack per PR.
- Branch naming free; base branch = parent PR's head branch. Roots base on trunk.
- Every PR in the tree gets the label, including merged ones (keeps history readable).
- Never rebase a child before its parent. Order is always parents → children (DFS).

## Setup (once per repo)

```sh
gh label create "stacktree:<name>" --color 0E8A16 --description "PR stack tree: <name>"
```
(The extension's "Add to a stack tree" popover creates the label automatically.)

## Create a stack tree

```sh
# root
git checkout -b feat/a trunk && git commit … && git push -u origin feat/a
gh pr create --base trunk --head feat/a --label "stacktree:<name>" --title … --body …

# child of feat/a
git checkout -b feat/b feat/a && git commit … && git push -u origin feat/b
gh pr create --base feat/a --head feat/b --label "stacktree:<name>" …

# sibling of feat/b (also child of feat/a)
git checkout -b feat/c feat/a …
gh pr create --base feat/a --head feat/c --label "stacktree:<name>" …
```

## Add an existing PR to a stack

```sh
gh pr edit <number> --base <parent-head-branch> --add-label "stacktree:<name>"
```

## Move a PR to another parent

```sh
git rebase --onto <new-parent-branch> <old-parent-branch> <branch>
git push --force-with-lease
gh pr edit <number> --base <new-parent-branch>
```

## Inspect

```sh
gh pr list --label "stacktree:<name>" --state all \
  --json number,title,headRefName,baseRefName,state,isDraft
```
Build the tree from `baseRefName` → `headRefName`. Trunk = the base of the roots.

## Rebase after trunk moved (local)

Parents first, DFS. For each PR in that order:

```sh
git checkout <branch>
git rebase <base-branch>            # base = parent's branch, or trunk for roots
git push --force-with-lease
```

Or, from the extension on any PR page: **Rebase subtree** / **Rebase tree**
(server-side `updatePullRequestBranch(REBASE)` in the same order).

## Merge

Merge along a path, root first. After merging a PR, its children are
retargeted to trunk by GitHub automatically; rebase them if needed:

```sh
gh pr merge <root> --squash --delete-branch
# for each child of <root>: base is now trunk
git checkout <child> && git rebase --onto trunk <root-branch> && git push --force-with-lease
```

Siblings are independent: merging one never requires the other.

## Remove from a stack

```sh
gh pr edit <number> --remove-label "stacktree:<name>"
```
(or **Leave stack** in the extension's card footer).

## Checklist before handing off

- [ ] every PR in the tree carries `stacktree:<name>`
- [ ] every PR's base is its parent's head branch (roots → trunk)
- [ ] no PR based on a merged branch (retarget to trunk)
- [ ] rebased parents → children, all pushed with `--force-with-lease`

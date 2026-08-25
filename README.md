# gh-stack-tree

Browser extension (Chrome/Firefox, [WXT](https://wxt.dev)) that renders tree-shaped PR stacks on github.com.

GitHub's native stacked PRs are linear. This extension reads a tree description
the CLI embeds in PR bodies and draws it in the PR sidebar, highlighting the
path from trunk to the current PR.

## How it works

Label every PR of a stack with `stacktree:<name>`. On a PR page the extension
finds that label, lists all PRs carrying it (GraphQL), and builds the tree from
each PR's base branch. Nothing is stored in PR bodies.

Needs a GitHub token in the extension options (fine-grained PAT,
`Pull requests: read` on the repos you use).

## Dev

```sh
pnpm install
pnpm dev          # chrome
pnpm dev:firefox
pnpm test
```

# gh-stack-tree

Browser extension (Chrome/Firefox, [WXT](https://wxt.dev)) that renders tree-shaped PR stacks on github.com.

GitHub's native stacked PRs are linear. This extension reads a tree description
the CLI embeds in PR bodies and draws it in the PR sidebar, highlighting the
path from trunk to the current PR.

## Body format

Fenced code block (HTML comments are stripped by GitHub):

```
```gh-stack-tree
{"trunk":"main","nodes":[{"pr":12,"branch":"feat/a","parent":null},{"pr":13,"branch":"feat/b","parent":12}]}
```
```

## Dev

```sh
pnpm install
pnpm dev          # chrome
pnpm dev:firefox
pnpm test
```

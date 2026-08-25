<p align="center"><img src="assets/logo.svg" width="96" alt="gh-stack-tree"></p>

# gh-stack-tree

[![CI](https://github.com/maastrich/gh-stack-tree/actions/workflows/ci.yml/badge.svg)](https://github.com/maastrich/gh-stack-tree/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Built with WXT](https://img.shields.io/badge/built%20with-WXT-67d55f)](https://wxt.dev)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

Browser extension (Chrome/Firefox, [WXT](https://wxt.dev)) that renders tree-shaped PR stacks on github.com.

GitHub's native stacked PRs are linear. This extension reads a tree description
the CLI embeds in PR bodies and draws it in the PR sidebar, highlighting the
path from trunk to the current PR.

## How it works

Label every PR of a stack with `stacktree:<name>`. On a PR page the extension
finds that label, lists all PRs carrying it (GraphQL), and builds the tree from
each PR's base branch. Nothing is stored in PR bodies.

Needs a GitHub token in the extension options — fine-grained PAT with
`Pull requests: read` to view, plus `Pull requests: write` and `Issues: write`
to rebase / add / leave stacks from the UI.

### PR page

- Pill next to the state badge: `⧉ ↓n ↑m` (n ancestors toward trunk, m
  descendants). Click for a popover with the tree.
- Card above the merge box: tree with CI, review state, diff stats; buttons
  **Rebase subtree**, **Rebase tree** (server-side, parents first), **Leave stack**.
- Unlabeled PR: `⧉ Stack` pill → add to the parent's stack in one click (when the
  base branch's PR is in one) or name a new/existing stack.
- GitHub's linear "Preview stack" banner is hidden on stacked PRs.

### /pulls

PRs sharing a label are grouped in a bordered block, ordered as a tree with
guide lines, native rows untouched.

## Agent skill

`skills/gh-stack-tree/SKILL.md` documents the label/base conventions and the
`git` + `gh` commands to create, extend, rebase and merge stack trees. Copy or
symlink it into your agent's skills directory (e.g. `.claude/skills/`).

## Dev

```sh
pnpm install
pnpm dev          # chrome
pnpm dev:firefox
pnpm test
```

## Install

Not on the stores yet. Build and load unpacked:

```sh
pnpm install && pnpm build          # → .output/chrome-mv3
pnpm build:firefox                  # → .output/firefox-mv2
```

Chrome / Arc / Edge: `chrome://extensions` → Developer mode → Load unpacked → `.output/chrome-mv3`.
Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → `.output/firefox-mv2/manifest.json`.

Then open the extension options and paste a GitHub token.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security issues: [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © Mathis Pinsault

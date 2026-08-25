<p align="center"><img src="extension/assets/logo.svg" width="96" alt="gh-stack-tree"></p>

# gh-stack-tree

[![CI](https://github.com/maastrich/gh-stack-tree/actions/workflows/ci.yml/badge.svg)](https://github.com/maastrich/gh-stack-tree/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Built with WXT](https://img.shields.io/badge/built%20with-WXT-67d55f)](https://wxt.dev)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

Tree-shaped PR stacks on GitHub. GitHub's native stacks are linear; this
project lets a PR have several children, declared with one label per PR:
`stacktree:<name>`. Parent/child relations come from each PR's base branch.

Three pieces, one repo:

| Piece | Dir | Install |
|---|---|---|
| Browser extension (WXT, TypeScript) — tree on PR pages and `/pulls`, rebase / join / leave from the UI | [`extension/`](extension) | release zips, or build unpacked |
| `gh` extension (Go) — `view`, `restack`, `label`, `unlabel`, `stacks` | [`cli/`](cli) | `gh extension install maastrich/gh-stack-tree` |
| Agent skill — the conventions and commands, for Claude Code & co | [`skills/`](skills) | `npx skills add maastrich/gh-stack-tree` |

## Conventions

- One label per PR: `stacktree:<name>` (short kebab-case). One stack per PR.
- Base branch = parent PR's head branch. Roots base on trunk.
- Rebase parents before children, always `--force-with-lease`.

## Browser extension

Reads the label on the current PR, lists PRs sharing it (GraphQL) and draws
the tree. Needs a GitHub token in the extension options — fine-grained PAT with
`Pull requests: read` to view, plus `Pull requests: write` and `Issues: write`
to rebase / join / leave from the UI.

**PR page**
- Pill next to the state badge: `⧉ ↓n ↑m` (n ancestors toward trunk, m descendants). Click for a popover with the tree.
- Card above the merge box: tree with CI, review state, diff stats; **Rebase subtree**, **Rebase tree** (server-side, parents first), **Leave stack**.
- Unlabeled PR: `⧉ Stack` pill → add to the parent's stack in one click, or name a new/existing stack (label created on demand).
- GitHub's linear "Preview stack" banner is hidden on stacked PRs.

**/pulls** — PRs sharing a label are grouped in a bordered block, ordered as a tree with guide lines, native rows untouched.

Install from a release: download `gh-stack-tree-<version>-chrome.zip` (or `-firefox.zip`), unzip, load unpacked (`chrome://extensions` → Developer mode; Firefox `about:debugging`). Or build it:

```sh
cd extension && pnpm install && pnpm build        # → .output/chrome-mv3
```

## gh extension

```sh
gh extension install maastrich/gh-stack-tree

gh stack-tree stacks                      # stacks in this repo
gh stack-tree view      [--stack NAME]    # ascii tree, current branch marked
gh stack-tree label     [NAME] [--pr N]   # add PR to a stack (inherits the parent's when NAME omitted)
gh stack-tree unlabel   [--pr N]
gh stack-tree restack   [--stack NAME] [-n] [--no-push] [-y] [--allow-diverged]
```

`restack` rebases every open branch of the stack onto its parent — the
parent's new tip when it moved, trunk when the parent's PR was merged —
parents first, then pushes with `--force-with-lease`. Guard rails:

- clean working tree required; only PRs carrying the label are touched
- local branches that diverged from origin are skipped (with their subtree) unless `--allow-diverged`
- a parent missing from the open set must have a merged PR, otherwise the branch is skipped rather than dropped onto trunk
- every branch is backed up under `refs/stack-tree/backup/<branch>` before it moves
- a conflict aborts and prints the exact `git rebase --onto …` to replay
- nothing is pushed unless every branch sits on its parent, and only after `-y` or an interactive confirmation; non-interactive runs never push silently

## Skill

`skills/gh-stack-tree/SKILL.md` — conventions plus the `git` + `gh` procedure
to create, extend, rebase and merge stack trees. `npx skills add maastrich/gh-stack-tree`,
or copy it into `.claude/skills/`.

## Releases

Continuous: [release-please](https://github.com/googleapis/release-please)
turns Conventional Commits on `main` into a release PR; merging it tags a
release, builds the `gh` extension binaries for every platform and attaches
the browser-extension zips.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security issues: [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © Mathis Pinsault

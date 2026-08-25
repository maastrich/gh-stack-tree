# Contributing

Thanks for helping out. Issues and pull requests are welcome.

## Setup

```sh
pnpm install
pnpm dev            # Chrome/Arc: load .output/chrome-mv3-dev as unpacked
pnpm dev:firefox
```

Set a GitHub token in the extension options (fine-grained PAT, `Pull requests:
read`; `write` + `Issues: write` for rebase / join / leave).

## Checks

```sh
pnpm compile        # tsc
pnpm test           # vitest
pnpm build          # production build
```

Run these before opening a PR. Keep changes focused; one topic per PR.

## Layout

- `entrypoints/github.content/` — PR page (pill, card, rebase, join/leave)
- `entrypoints/pulls.content/` — `/pulls` grouping
- `entrypoints/background.ts` — all GitHub GraphQL calls (token never reaches content scripts)
- `entrypoints/options/` — token settings
- `lib/` — pure logic (`infer.ts` tree inference, `tree.ts` traversal, `render.ts` DOM)
- `skills/` — agent-facing procedure for the label/base conventions

GitHub's DOM changes often; selectors live in the content scripts and are the
usual thing to fix. Prefer `data-component` / `data-testid` hooks over class
names.

## Commits

Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`). Subject ≤ 72 chars.

## Code of conduct

Be kind. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

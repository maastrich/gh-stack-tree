# Contributing

Thanks for helping out. Issues and pull requests are welcome.

## Setup

```sh
cd extension && pnpm install
pnpm dev            # Chrome/Arc: load extension/.output/chrome-mv3-dev as unpacked
pnpm dev:firefox

cd cli && go build -o gh-stack-tree . && gh extension install .   # local gh extension
```

Set a GitHub token in the extension options (fine-grained PAT, `Pull requests:
read`; `write` + `Issues: write` for rebase / join / leave).

## Checks

```sh
cd extension && pnpm compile && pnpm test && pnpm build
cd cli && gofmt -l . && go vet ./... && go test ./...
```

Run these before opening a PR. Keep changes focused; one topic per PR.

## Layout

- `extension/` — WXT browser extension
  - `entrypoints/github.content/` — PR page (pill, card, rebase, join/leave)
  - `entrypoints/pulls.content/` — `/pulls` grouping
  - `entrypoints/background.ts` — all GitHub GraphQL calls (token never reaches content scripts)
  - `lib/` — pure logic (`infer.ts` tree inference, `tree.ts` traversal, `render.ts` DOM)
- `cli/` — Go `gh` extension (`cmd/` subcommands, `internal/{git,gh,tree}`)
- `skills/` — agent-facing procedure for the label/base conventions
- `scripts/build-gh-extension.sh` — cross-compiles the CLI for releases

GitHub's DOM changes often; selectors live in the content scripts and are the
usual thing to fix. Prefer `data-component` / `data-testid` hooks over class
names.

## Commits

Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`). Subject ≤ 72 chars.
release-please derives the changelog and version from them.

## Code of conduct

Be kind. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

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
Add a changeset (`pnpm changeset`) to any user-facing change.

## Code of conduct

Be kind. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Store publishing

`release.yml` submits to the Chrome Web Store, Firefox Add-ons and Edge
Add-ons on every tag, each gated on its secrets. First-time setup
(maintainers):

1. Create the listing manually once (upload a release zip) — Chrome:
   https://chrome.google.com/webstore/devconsole ($5 one-time), Firefox:
   https://addons.mozilla.org/developers/, Edge:
   https://partner.microsoft.com/dashboard/microsoftedge. "Unlisted" is fine.
2. Generate API credentials with the WXT wizard:

   ```sh
   cd extension && pnpm wxt submit init
   ```

   It prints the env vars: `CHROME_EXTENSION_ID`, `CHROME_CLIENT_ID`,
   `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`; `FIREFOX_EXTENSION_ID`,
   `FIREFOX_JWT_ISSUER`, `FIREFOX_JWT_SECRET`; `EDGE_PRODUCT_ID`,
   `EDGE_CLIENT_ID`, `EDGE_API_KEY`.
3. Add them as repository secrets (`gh secret set NAME`). Any store whose
   ID secret is missing is skipped.

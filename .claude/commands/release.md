---
description: Cut a new release of gh-stack-tree (gh extension + browser extension) from the current main
allowed-tools: Bash(git:*), Bash(pnpm:*), Bash(gh run:*), Bash(gh release:*), Bash(cat:*), Bash(ls:*)
---

# Release gh-stack-tree

Consume all pending `.changeset/*.md` files, bump the version, push the
release commit to `main`, then create and push the matching tag so
`.github/workflows/release.yml` builds the `gh` extension binaries, zips the
browser extension and publishes a GitHub Release.

One version covers both pieces: `extension/package.json` is the source of
truth; the Go binary gets the tag at build time.

## Hard rule

**The release commit must be on `main` before the tag is created.** The
release workflow triggers on tag push (`v*.*.*`) and checks out the tag's
ref — if the release commit is only on a branch or local, the workflow runs
against the wrong tree. Never tag first and push later.

## Preconditions

Before starting, verify all of:

1. `git branch --show-current` → `main`
2. `git status` → clean working tree
3. `git fetch origin && git status` → up to date with `origin/main`
4. `ls .changeset/*.md | grep -v README.md` → at least one pending changeset.
   If none, stop and tell the user there is nothing to release.
5. `gh run list --workflow=ci.yml --branch main --limit 1` → last CI run on
   main is green.

If any precondition fails, stop and report — do not try to fix it as part
of the release.

## Steps

1. **Bump version and consume changesets**

   ```bash
   pnpm run version
   ```

   Runs `changeset version`: updates `extension/package.json`, regenerates
   `extension/CHANGELOG.md`, deletes the consumed `.changeset/*.md`. Review:

   ```bash
   git diff extension/package.json extension/CHANGELOG.md
   git status
   ```

   Capture the new version from `extension/package.json` — call it
   `$VERSION` (e.g. `0.2.0`).

2. **Commit the release to `main`** — bare one-liner, no prefix, no trailer:

   ```bash
   git add -A
   git commit -m "release $VERSION"
   ```

3. **Push to `main` first**

   ```bash
   git push origin main
   ```

   If rejected, stop: do **not** force-push, do **not** tag. Pull, rebase,
   restart from step 1.

4. **Tag and push the tag** — only after `main` has the release commit:

   ```bash
   git tag "v$VERSION"
   git push origin "v$VERSION"
   ```

5. **Watch the release workflow**

   ```bash
   gh run list --workflow=release.yml --limit 1
   gh run watch
   ```

   Jobs: `release` (GitHub Release with notes), `gh-extension`
   (cross-compiled binaries via `cli/gh-extension-precompile`),
   `browser-extension` (chrome + firefox zips attached). If it fails, do not
   re-tag: fix on a branch, merge, bump to a new patch, release again.

## Recovery: tag pushed before main

1. `git push origin :refs/tags/vX.Y.Z`
2. `git tag -d vX.Y.Z`
3. `gh run cancel <run-id>` if still running
4. Push the release commit to `main`, then re-tag and push the tag.

## Notes

- `.changeset/config.json` has `commit: false`; step 2 is manual on purpose.
- `gh extension upgrade stack-tree` picks up the new binaries; the browser
  extension is installed from the release zips until it is on the stores.

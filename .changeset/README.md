# Changesets

Every user-facing change ships with a changeset:

```sh
pnpm changeset            # pick bump, describe the change
```

Releases are cut by a maintainer with the `/release` command
(`.claude/commands/release.md`): `pnpm version` → commit `release X.Y.Z` on
`main` → push tag `vX.Y.Z` → `.github/workflows/release.yml` builds and
publishes.

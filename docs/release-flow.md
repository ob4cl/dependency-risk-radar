# Release flow

This document captures the minimum repeatable release process for `dradar`.

## Goal

Keep releases boring, deterministic, and easy to verify.

## Recommended flow

From the repo root:

```bash
# 1. Bump the CLI package version
cd apps/cli
npm version patch --no-git-tag-version

# 2. Return to the repo root and verify the release surface
cd ../..
corepack pnpm release:check

# 3. Inspect the tarball one more time if desired
corepack pnpm release:pack

# 4. Publish the CLI package
corepack pnpm release:publish
```

## What `release:check` does

- builds the TypeScript workspace
- runs the full repo test suite
- runs the CLI package pack dry-run

## Release checklist

- [ ] `apps/cli/package.json` version is bumped
- [ ] `corepack pnpm build` passes
- [ ] `corepack pnpm test` passes
- [ ] `corepack pnpm release:pack` shows the expected tarball contents
- [ ] README examples still match the shipped CLI
- [ ] any breaking output changes are documented

## Notes

- `release:publish` only publishes the CLI package, not the whole monorepo.
- The package name is `dradar` and the binary is `radar`.
- If you need a different semver bump, use `npm version minor --no-git-tag-version` or `npm version major --no-git-tag-version` inside `apps/cli`.

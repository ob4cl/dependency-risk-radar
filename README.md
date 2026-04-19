# Dependency Risk Radar

Dependency Risk Radar is a local-first dependency change analyzer for JavaScript and TypeScript repositories.

It answers one question:

> Is this dependency change safe enough to merge, and if not, why?

## What it does

- Detects dependency additions, removals, upgrades, downgrades, and lockfile-only changes
- Works with `package.json`, `package-lock.json`, and `pnpm-lock.yaml`
- Produces deterministic JSON analysis output
- Produces a Markdown review summary for pull requests
- Supports explicit output modes (`--format json|markdown|both`)
- Can optionally enrich results with live provider metadata via `--live-metadata`

## What it does not do in v1

- No web dashboard
- No GitHub App
- No Python, Rust, Java, Docker, or multi-ecosystem support
- No SBOM export
- No cloud backend
- No machine-learning trust model
- No distributed workers

## Supported ecosystems

- npm / package-lock.json
- pnpm / pnpm-lock.yaml

## Local dev quickstart

```bash
corepack enable
corepack pnpm install
corepack pnpm analyze -- --repo . --base main --head HEAD
```

The repo root keeps the local workflow simple:

- `corepack pnpm analyze` runs the CLI against the current checkout
- `corepack pnpm review-pr` renders the PR-oriented review flow
- `corepack pnpm explain` prints a package-level risk explanation stub
- `corepack pnpm init-policy` writes a starter policy file

## CLI commands

```bash
corepack pnpm analyze -- --repo . --base main --head HEAD
corepack pnpm review-pr -- --repo . --base main --head HEAD --policy ./dependency-risk-radar.yaml
corepack pnpm explain -- npm react@19.1.0
corepack pnpm init-policy
```

## npm-packable CLI package

The publishable npm unit lives in `apps/cli` as `dependency-risk-radar`.

Today the workspace is set up for local execution and packaging inspection. The package can be packed from the CLI folder, and `npm pack` is the right way to verify what would ship.

```bash
cd apps/cli
npm pack --dry-run --json
npm pack
```

Use the dry run output to check:

- which files are included
- whether the bin entry points at the right path
- whether the tarball is carrying only the intended release surface

The publishable package is intended to ship `dist/` only. Before a real registry publish, make sure the installed binary points to runnable JavaScript, not just TypeScript source.

For the package-level release checklist, see `apps/cli/README.md`.

## Publishing prerequisites

Before you publish to npm, line up the registry-side details first:

- Run `npm login` locally and confirm `npm whoami`
- Verify the package name and scope are owned by the account or org that will publish it
- Decide whether the package should be public or restricted on npm
- If publishing from CI, create an automation token with publish rights and inject it as `NPM_TOKEN`
- Set the registry auth entry in CI with the standard npm token form:

```ini
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
```

The repo can stay private on GitHub while the CLI package is published separately on npm.

## MCP usage in Hermes

The MCP server will expose these tools:

- `analyze_dependency_diff`
- `explain_package_risk`
- `review_pull_request_dependencies`
- `generate_policy_file`

Agent activation keyword for the full team: `use agent team`

## Current milestone

Implemented now:

- Monorepo scaffold
- Shared schemas and types
- npm / pnpm manifest and lockfile parsing
- Dependency delta generation
- Minimal CLI analyze flow
- Provider layer with deterministic fallback
- CLI output contract with explicit format options
- Initial tests and docs

Still pending:

- Full scoring and policy enforcement expansion
- MCP server implementation
- GitHub Action wrapper

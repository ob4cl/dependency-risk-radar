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

## Quickstart

```bash
corepack enable
corepack pnpm install
corepack pnpm analyze -- --repo . --base main --head HEAD
```

## CLI

```bash
radar analyze --repo . --base main --head HEAD
radar review-pr --repo . --base main --head HEAD --policy ./dependency-risk-radar.yaml
radar explain npm react@19.1.0
radar init-policy
```

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

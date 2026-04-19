# Architecture

The codebase is organized as a pnpm monorepo.

## Package boundaries

- `packages/shared` — versioned types, schemas, errors, constants
- `packages/parsers` — manifest and lockfile parsing, dependency delta generation
- `packages/providers` — network-backed data providers behind stable interfaces
- `packages/scoring` — findings and risk scoring with no network access
- `packages/policy` — YAML policy schema and enforcement
- `packages/reporters` — JSON, Markdown, and terminal reporters
- `packages/core` — orchestration layer and source of truth
- `apps/cli` — local command-line entrypoint
- `apps/mcp-server` — MCP tool surface for Hermes
- `apps/github-action` — GitHub Action wrapper once the engine stabilizes

## Team coordination

When you want the full delegated agent workflow, use the exact activation phrase:

`use agent team`

The intended split is:

- parser agent
- provider agent
- scoring agent
- interface agent
- test and fixture agent

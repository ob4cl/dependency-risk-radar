# Dependency Risk Radar

Dependency Risk Radar is a local-first dependency risk analyzer for pull-request and branch comparisons.

It compares two Git refs, inspects manifest + lockfile dependency changes, scores risk, and returns machine-readable JSON plus review-friendly Markdown.

## What the tool does

- Analyzes dependency changes between `base` and `head` refs
- Supports npm and pnpm lockfile formats
- Scores risk using policy-driven thresholds and controls
- Produces deterministic JSON output for automation
- Produces Markdown summaries for review workflows
- Provides:
  - CLI (`radar`)
  - MCP server
  - GitHub Action wrapper

## Supported ecosystems

- npm (`package-lock.json`)
- pnpm (`pnpm-lock.yaml`)

## Current limitations

- JavaScript/TypeScript dependency workflows only (no Python/Rust/Java support yet)
- No dashboard or backend service
- No SBOM export
- No automatic package remediation

## Installation

Published package:

```bash
npm install -g dradar
```

Local workspace development:

```bash
corepack enable
corepack pnpm install
corepack pnpm build
corepack pnpm test
```

## CLI usage

Analyze dependency changes:

```bash
radar analyze --repo . --base main --head HEAD
```

Render markdown only:

```bash
radar review-pr --repo . --base main --head HEAD --format markdown
```

Use explicit policy file:

```bash
radar analyze --repo . --base main --head HEAD --policy ./dependency-risk-radar.yaml
```

Initialize a starter policy:

```bash
radar init-policy --out ./dependency-risk-radar.yaml
```

## MCP usage

MCP server package: `apps/mcp-server`

Exposed tools:

- `analyze_dependency_diff`
- `explain_package_risk`
- `review_pull_request_dependencies`
- `generate_policy_file`

## Policy file example

```yaml
ecosystems:
  npm:
    enabled: true
  pnpm:
    enabled: true

thresholds:
  block_score: 70
  warn_score: 25

policies:
  block_known_critical_vulns: true
  require_lockfile: true
  require_manual_review_for_install_scripts: true

licenses:
  deny:
    - GPL-3.0
    - AGPL-3.0

packages:
  deny:
    - example-banned-package
```

## GitHub Action

Local action path: `apps/github-action`

Action outputs:

- `json`
- `markdown`
- `decision`
- `score`
- `exit-code-recommendation`

## Security disclosures

Please report vulnerabilities privately (do not open public issues for security reports).
See `SECURITY.md`.

## Release status

This repository is in pre-1.0 hardening mode for first public release.
Core security boundaries, packaging validation, and release workflows are in place; additional ecosystem support is planned post-1.0.

# Dependency Risk Radar

Dependency Risk Radar helps senior DevOps and platform teams answer one question before merge:

"Will this dependency change increase supply-chain risk beyond policy?"

It is a deterministic, local-first gate for dependency changes in JavaScript/TypeScript repos.

## Why this exists

Most dependency checks are either noisy, opaque, or too late in the pipeline.
Dependency Risk Radar focuses on practical pre-merge decisions:

- compare `base` vs `head`
- identify dependency deltas from manifest + lockfile
- score risk with explicit policy thresholds
- produce machine-readable JSON and review-ready Markdown

No dashboards. No hidden scoring logic. No cloud lock-in.

## Built for DevOps teams

- Deterministic output for CI gates and audit trails
- Policy-driven decisions (`warn_score`, `block_score`, critical vuln block)
- Strict filesystem trust boundaries for repo/policy paths
- Clear pass/warn/high-risk/fail recommendations
- Easy to run in CLI, GitHub Action, or MCP workflows

## Supported ecosystems

- npm (`package-lock.json`)
- pnpm (`pnpm-lock.yaml`)

## Current limitations (v1)

- JavaScript/TypeScript dependency workflows only
- No SBOM export
- No automated remediation
- No multi-ecosystem support (Python/Rust/Java not yet supported)

## Install

Global install:

```bash
npm install -g dradar
```

Local development:

```bash
corepack enable
corepack pnpm install
corepack pnpm build
corepack pnpm test
```

## CLI quick start

Analyze dependency changes:

```bash
radar analyze --repo . --base main --head HEAD
```

PR-style review output:

```bash
radar review-pr --repo . --base main --head HEAD --format markdown
```

Use explicit policy:

```bash
radar analyze --repo . --base main --head HEAD --policy ./dependency-risk-radar.yaml
```

Generate starter policy:

```bash
radar init-policy --out ./dependency-risk-radar.yaml
```

## Policy example

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

## MCP usage

MCP server lives in `apps/mcp-server`.

Exposed tools:

- `analyze_dependency_diff`
- `explain_package_risk`
- `review_pull_request_dependencies`
- `generate_policy_file`

## GitHub Action usage

Local action wrapper lives in `apps/github-action`.

Outputs:

- `json`
- `markdown`
- `decision`
- `score`
- `exit-code-recommendation`

## Security disclosures

Do not report vulnerabilities in public issues.

Please follow `SECURITY.md` for private disclosure.

## Release status

Pre-1.0, release-hardening complete for first public publication.

If you want the full release checklist and local verification commands, see `RELEASE_READINESS.md`.

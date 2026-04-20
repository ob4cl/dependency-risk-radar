# Dependency Risk Radar

Dependency Risk Radar is a deterministic dependency-change gate for DevOps and platform teams.

It answers one pre-merge question:

"Does this dependency delta violate our risk policy?"

Instead of generic vulnerability noise, it analyzes direct dependency deltas between two refs (from manifest/lockfile roots), scores transitive impact with explicit policy, and returns actionable output for CI and reviewers.

## Who this is for

- DevOps teams enforcing supply-chain controls in CI/CD
- Platform engineering teams maintaining org-wide merge standards
- Security-conscious maintainers who need auditable dependency decisions
- Teams that want local-first tooling without SaaS lock-in

## Why teams use it

- Deterministic results (same refs + same policy = same decision)
- Policy-first decisions (`warn_score`, `block_score`, critical vuln blocking)
- CI-ready output contract (JSON + Markdown + exit recommendation)
- Strict path sandboxing for repo/policy trust boundaries
- Works as CLI, GitHub Action, or MCP service

## What it does

Given `base` and `head` refs, Dependency Risk Radar:

1. Parses manifest + lockfile for npm/pnpm
2. Computes normalized direct dependency deltas from manifest roots
3. Computes transitive impact signals (blast-radius deltas) per changed direct dependency
4. Optionally enriches metadata/vulnerabilities from providers
5. Scores risk with policy controls
6. Produces:
   - structured JSON for automation
   - Markdown for code review context
   - decision + recommended exit behavior

## Decision model

Final decision values:

- `pass`
- `warn`
- `high-risk`
- `fail`

Typical interpretation:

- `pass`: safe to proceed under policy
- `warn`: merge allowed but reviewer attention required
- `high-risk`: elevated risk; usually requires explicit approval/escalation
- `fail`: block merge (policy or critical risk threshold)

## Supported ecosystems

- npm (`package-lock.json`)
- pnpm (`pnpm-lock.yaml`)

## Current limitations (v1)

JavaScript/TypeScript dependency workflows only
Direct dependency deltas are computed from root manifest entries (`package.json` dependencies) plus lockfile resolution
Transitive analysis is currently impact scoring (reachable-package delta), not a full workspace-wide graph diff
Current analysis scope is repo-root `package.json` + lockfile, not full multi-workspace manifest discovery
No SBOM export
No automated remediation/fix PR generation
No Python/Rust/Java ecosystem support yet

## Install

Global CLI install:

```bash
npm install -g dradar
```

Run without global install:

```bash
npx dradar analyze --repo . --base main --head HEAD
```

Local development in this monorepo:

```bash
corepack enable
corepack pnpm install
corepack pnpm build
corepack pnpm test
```

## Quick start (CLI)

Analyze dependency changes between `main` and current commit:

```bash
radar analyze --repo . --base main --head HEAD
```

Render Markdown only (PR-friendly):

```bash
radar review-pr --repo . --base main --head HEAD --format markdown
```

Use explicit policy file:

```bash
radar analyze \
  --repo . \
  --base main \
  --head HEAD \
  --policy ./dependency-risk-radar.yaml
```

Generate starter policy file:

```bash
radar init-policy --out ./dependency-risk-radar.yaml
```

## CLI reference

Primary commands:

- `radar analyze`
- `radar review-pr`
- `radar init-policy`
- `radar explain` (metadata/risk context helper)

Common flags:

- `--repo <path>`: repository to analyze
- `--base <ref>`: baseline ref
- `--head <ref>`: candidate ref
- `--policy <path>`: explicit policy file
- `--format json|markdown|both`
- `--live-metadata`: enable provider-backed enrichment

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

scoring:
  high_risk_score: 50
  weights:
    vulnerability: 40
    install_time_execution: 20
    blast_radius: 15
    maintenance_trust: 15
    policy: 10

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

## Scoring signals (high-level)

Risk findings are driven by combinations of:

- known vulnerabilities (including critical-vuln blocking policy)
- install-time execution hooks
- transitive blast-radius deltas (derived from lockfile graph size changes under each changed direct dependency)
- maintenance-trust signals from metadata
- explicit package/license policy denies

Thresholds and scoring weights are policy-controlled and auditable.

## JSON output contract (example shape)

```json
{
  "analysisVersion": "0.1.0",
  "repoPath": "/repo",
  "baseRef": "main",
  "headRef": "HEAD",
  "generatedAt": "2026-04-19T00:00:00.000Z",
  "summary": {
    "decision": "warn",
    "totalRiskScore": 35
  },
  "dependencyChanges": [],
  "findings": [],
  "markdownReport": "...",
  "policyApplied": true,
  "exitCodeRecommendation": 0
}
```

## GitHub Action usage

Action source lives in `apps/github-action`.

Exposed outputs:

- `json`
- `markdown`
- `decision`
- `score`
- `exit-code-recommendation`

Minimal workflow usage:

```yaml
- name: Dependency Risk Radar
  id: radar
  uses: ./apps/github-action
  with:
    repo: .
    base: ${{ github.event.pull_request.base.sha }}
    head: ${{ github.event.pull_request.head.sha }}
    format: markdown
    live-metadata: false

- name: Enforce block
  run: |
    echo "Decision: ${{ steps.radar.outputs.decision }}"
    echo "Score: ${{ steps.radar.outputs.score }}"
    test "${{ steps.radar.outputs.exit-code-recommendation }}" -eq 0
```

Notes:

- Action logs are intentionally concise.
- Full Markdown goes to step summary/output channels.
- Raw untrusted report payloads are not dumped to stdout.

## MCP usage

MCP server is in `apps/mcp-server`.

Exposed tools:

- `analyze_dependency_diff`
- `explain_package_risk`
- `review_pull_request_dependencies`
- `generate_policy_file`

This is useful for agent-driven dependency review workflows where deterministic tool output is required.

## Security model and trust boundaries

Dependency Risk Radar hardens path handling for analysis and policy loading:

- `repoPath` must resolve within an allowed workspace root
- realpath checks prevent traversal and symlink escape
- explicit `policyPath` is fail-closed and restricted to:
  - repo root, or
  - explicitly allowed config directory

If policy path is missing/unreadable/invalid, analysis fails (no silent fallback).

## Recommended CI workflow

1. Run analyzer on each PR
2. Publish Markdown to step summary / PR comment
3. Gate merge using `exit-code-recommendation`
4. Keep policy file versioned in repo
5. Review policy changes via normal PR review process

## Architecture (high level)

```text
PR / commit refs (base, head)
            |
            v
      Dependency delta engine
   (direct root deps + transitive impact)
            |
            v
   Optional metadata/vuln providers
      (npm registry, OSV API)
            |
            v
      Policy + scoring engine
 (thresholds, deny lists, critical block)
            |
            v
   Outputs: JSON + Markdown + decision
            |
            v
   CLI / GitHub Action / MCP consumers
```

Design goals:

- deterministic core analysis first
- optional live enrichment second
- explicit policy controls for final decision
- machine + human outputs from same run artifact

## Operational runbook (DevOps)

Use this as the standard on-call / release-engineering procedure.

1. Baseline check
   - run analyzer against current PR/base pair
   - capture `decision`, `score`, and top findings
2. If decision is `pass`
   - merge allowed under policy
3. If decision is `warn`
   - reviewer acknowledges findings in PR
   - merge may proceed with normal approval path
4. If decision is `high-risk`
   - require security/platform approval
   - document exception or mitigation in PR thread
5. If decision is `fail`
   - block merge
   - require dependency change, policy correction, or explicit security waiver process

Suggested escalation matrix:

- `warn`: service owner + reviewer
- `high-risk`: service owner + platform/security approver
- `fail`: security sign-off required before unblocking

## Policy governance examples

### Example A: strict production policy

- `warn_score: 20`
- `block_score: 50`
- `block_known_critical_vulns: true`
- deny risky licenses and known-problematic packages

Best for: internet-facing services, regulated workloads.

### Example B: balanced platform policy

- `warn_score: 30`
- `block_score: 70`
- critical vuln blocking enabled
- install-script review required

Best for: most internal services.

### Example C: migration window policy (temporary)

- keep critical blocking enabled
- raise `warn_score`/`block_score` temporarily
- require issue/ticket link in PR for every override
- set explicit expiry date for relaxed policy

Best for: large dependency modernization waves.

## Local release validation

From repo root:

```bash
corepack pnpm build
corepack pnpm test
corepack pnpm --dir apps/cli run release:check
corepack pnpm --dir apps/cli run pack:dry-run
```

For complete publication readiness instructions, see `RELEASE_READINESS.md`.

## Open-source project hygiene

This repository includes:

- `LICENSE`
- `SECURITY.md`
- `CONTRIBUTING.md`
- `CODEOWNERS`
- issue and PR templates
- dependency review and release validation workflows

## Adoption signals and release hygiene (recommended)

For external credibility, maintainers should keep these visible signals up to date:

- [ ] publish Git tags for released versions
- [ ] create GitHub Releases with notes for each published version
- [ ] keep repository description concise and specific (what DRR does today)
- [ ] set relevant GitHub topics (for example: `security`, `supply-chain`, `dependencies`, `ci`)
- [ ] link package/release artifacts from README and release notes
- [ ] keep `CHANGELOG.md` aligned with tags/releases

## Contributing

Please read `CONTRIBUTING.md` before opening PRs.

If your change affects path handling, policy evaluation, or action output, include adversarial tests and CI validation evidence.

## Security disclosures

Do not report vulnerabilities in public issues.

Follow `SECURITY.md` for private disclosure instructions.

## Release status

Pre-1.0, release-hardening complete for first public publication.

Core security boundaries, policy enforcement, packaging reliability, and public-repo hygiene are in place for initial adoption by DevOps teams.

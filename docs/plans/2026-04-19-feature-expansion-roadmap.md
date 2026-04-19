# Dependency Risk Radar Feature Expansion Plan

> For Hermes: execute in small PRs, one feature track at a time, with TDD.

Goal: deliver the currently listed v1 limitations as post-v1 feature tracks with minimal risk to existing deterministic behavior.

Architecture: keep the existing core analysis pipeline stable and add capabilities as opt-in modules behind explicit flags/policy. Preserve deterministic outputs in offline mode.

Tech stack: TypeScript monorepo, Vitest, existing packages (`core`, `parsers`, `providers`, `policy`, `scoring`, `reporters`, `apps/*`).

---

## Track 1: SBOM export

Objective: add CycloneDX JSON export without changing current JSON/Markdown outputs.

Scope:
- New reporter in `packages/reporters` for SBOM output
- CLI `--format sbom` and `--format both+sbom` style option (final shape TBD)
- Optional GitHub Action output `sbom`

Tasks:
1. Add failing tests for SBOM reporter contract (package identity, versions, dependency edges)
2. Implement reporter with deterministic ordering
3. Wire CLI output mode
4. Wire action output key (optional; gated)
5. Add docs + sample output fixture

Exit criteria:
- deterministic SBOM snapshots in tests
- no regressions in existing report formats

---

## Track 2: Automated remediation / fix PR generation

Objective: generate suggested safe upgrades and optional patch PR scaffolding.

Scope:
- Start with suggestion mode only (no auto-merge)
- Produce machine-readable remediation plan output
- Add optional GitHub PR draft creation workflow in separate command

Tasks:
1. Add failing tests for remediation candidate generation (respect policy + semver constraints)
2. Implement remediation engine in new package/module
3. Add CLI command `radar remediate --plan` (dry-run first)
4. Add optional `--create-pr` path behind explicit confirmation flag
5. Add guardrails: never downgrade unless explicit, never bypass denied policy

Exit criteria:
- deterministic remediation plans
- PR generation fully opt-in and auditable

---

## Track 3: Multi-ecosystem support (Python, Rust, Java)

Objective: expand parser and delta support while keeping existing npm/pnpm behavior unchanged.

Scope (phase order):
1) Python (requirements/poetry lock)
2) Rust (Cargo.toml/Cargo.lock)
3) Java (Maven/Gradle lock/dependency trees)

Tasks per ecosystem:
1. Add parser fixtures + failing tests
2. Implement manifest parser
3. Implement lockfile/dependency graph parser
4. Normalize delta into shared schema
5. Add ecosystem-specific metadata provider adapter (if available)
6. Extend policy schema toggles
7. Add CLI docs/examples

Exit criteria per ecosystem:
- end-to-end analyze test for added/upgraded/removed deps
- scoring and policy behave identically through normalized schema

---

## Cross-cutting constraints

- Keep strict TypeScript checks
- No broad refactors
- Preserve existing architecture and output compatibility
- All feature tracks behind explicit flags/modes initially
- Add tests for every behavior change

## Suggested implementation order

1. SBOM export (lowest operational risk)
2. Python ecosystem (highest demand, manageable complexity)
3. Remediation plan (dry-run only)
4. Rust ecosystem
5. Java ecosystem
6. Optional PR-generation automation hardening

## Suggested PR slicing

- PR 1: SBOM reporter + CLI output mode
- PR 2: Python parsing + normalized delta
- PR 3: Remediation planner dry-run
- PR 4: Rust parsing
- PR 5: Java parsing baseline
- PR 6: Optional PR creation automation

## Verification baseline for each PR

```bash
corepack pnpm build
corepack pnpm test
corepack pnpm --dir apps/cli run release:check
```

## Notes

- Keep policy and scoring source of truth in existing policy package.
- Add any new provider calls as optional enrichment only.
- Maintain stable ordering in all new JSON outputs to prevent CI snapshot churn.

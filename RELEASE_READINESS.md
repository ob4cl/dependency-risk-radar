# Release Readiness

## What was fixed

1. Security and path sandboxing
- Repo path resolution is constrained to an allowed workspace root with realpath checks.
- Explicit policy path loading is constrained to:
  - repository root, or
  - explicitly configured `allowedConfigRoot`.
- Path traversal and symlink escape attempts are rejected with typed errors.
- Added tests for workspace-root policy rejection and explicit config-root allow behavior.

2. Policy handling fail-closed
- Explicit `policyPath` already fails closed on missing, unreadable, and invalid files.
- Verified with path sandbox tests.

3. Metadata hardening and consistency
- Metadata normalization keeps scoring-facing fields on top-level metadata (`license`, `repository`, `homepage`, `description`).
- Provider source attribution stays consistent via `metadata.extra.metadataSource`.
- Added raw provider payload retention under `metadata.extra.providerMetadataRaw`.

4. Vulnerability severity robustness
- OSV severity parsing remains robust for structured values and degrades cleanly to `unknown`.
- Existing severity normalization tests pass.

5. GitHub metadata provider cleanup
- Removed the broken GitHub metadata provider path that inferred repo slug from package names.
- Removed unused GitHub slug parser helper.

6. npm packaging/installability
- Publishable CLI package metadata hardened (`license`, `repository`, `homepage`, `bugs`, `keywords`, `engines`, explicit `bin`).
- Removed workspace dependency leakage from publish surface.
- Build output switched to `dist/cli.cjs` for stable runtime behavior after install.
- Added packaging test proving tarball installs and runs in a clean temp directory.

## What was added

Open-source and security repo files:
- `LICENSE`
- `SECURITY.md`
- `CONTRIBUTING.md`
- `CODEOWNERS`
- `.github/CODEOWNERS`
- `CHANGELOG.md`

Public-repo hygiene:
- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/ISSUE_TEMPLATE/feature_request.yml`
- `.github/pull_request_template.md`
- `.github/dependabot.yml`

Workflows:
- `.github/workflows/ci.yml`
- `.github/workflows/dependency-review.yml`
- `.github/workflows/release-validation.yml`
- `.github/workflows/npm-publish.yml` (manual scaffold)

Docs:
- README updated for public release: purpose, ecosystems, limitations, install, CLI usage, MCP usage, policy example, security disclosure, release-status note.

## Remaining known limitations

- Scope remains npm/pnpm dependency analysis only.
- No automated remediation or SBOM export in v1.
- npm commands in this environment print non-blocking warnings about unknown npm env config keys (`verify-deps-before-run`, `npm-globalconfig`, `_jsr-registry`, etc.). Packaging and tests still pass.

## Exact pre-publication steps to run locally

From repo root:

```bash
corepack enable
corepack pnpm install
corepack pnpm build
corepack pnpm test
```

Validate publishable package:

```bash
corepack pnpm --dir apps/cli run release:check
corepack pnpm --dir apps/cli run pack:dry-run
```

Optional explicit dry-run publish check (no publish):

```bash
cd apps/cli
npm publish --dry-run --access public
```

If all green, publish from `apps/cli` when ready:

```bash
cd apps/cli
npm publish --access public
```

# Release readiness notes

Dependency Risk Radar v1 uses deterministic report output with policy-configurable scoring.

## Default scoring contract

- 0-24: pass
- 25-49: warn
- 50-69: high-risk
- 70+: fail

These defaults are configurable through policy (`thresholds.*`, `scoring.high_risk_score`, `scoring.weights.*`).

## Policy contract

- `packages.deny` blocks specific package names
- `licenses.deny` blocks specific license identifiers
- `require_manual_review_for_install_scripts` turns install-time hooks into a scored finding
- Deny lists are normalized before scoring so policy evaluation stays deterministic

## Reporter contract

- JSON output stays pretty-printed and machine-readable
- Markdown output is stable, human-readable, and sourced from the same analysis result
- Findings are rendered in analysis order with explicit scores and evidence

## Release checklist

- Keep `warn_score` aligned with the v1 default banding unless a policy override is intentional
- Update docs/tests whenever scoring bands, weights, or policy inputs change
- Verify JSON and Markdown outputs remain in sync with the shared analysis result

## External adoption signals checklist (recommended)

- [ ] Create/push a Git tag for every published CLI version
- [ ] Publish a GitHub Release with user-facing notes for each tag
- [ ] Keep repository description aligned with current scope (direct dependency delta + transitive impact scoring)
- [ ] Add and maintain relevant GitHub topics for discovery
- [ ] Ensure README install/usage examples match the currently published package

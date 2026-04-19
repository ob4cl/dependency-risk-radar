# Release readiness notes

Dependency Risk Radar v1 uses fixed scoring bands and deterministic report output.

## Scoring contract

- 0-24: pass
- 25-49: warn
- 50-69: high-risk
- 70+: fail

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

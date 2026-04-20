# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.1.1] - 2026-04-20

### Credibility and release-readiness improvements
- Removed machine-specific absolute test paths; integration/packaging/action tests now resolve repository root relative to test file location.
- Added policy-configurable scoring controls:
  - `scoring.high_risk_score`
  - `scoring.weights.{vulnerability,install_time_execution,blast_radius,maintenance_trust,policy}`
- Updated scoring engine decision boundaries to honor policy-provided high-risk thresholds while preserving default behavior.
- Expanded policy and scoring tests to cover default compatibility and custom threshold/weight behavior.
- Corrected README scope claims to match implementation (direct dependency deltas + transitive impact scoring).
- Added adoption-signal and release-hygiene checklists in project docs.
- Updated GitHub repository metadata (description and topics) for discoverability.

### Security and release hardening
- Path sandbox enforcement tightened for repository and policy file handling.
- Explicit policy path now fails closed on missing/unreadable/invalid files.
- GitHub Action output path hardened to keep logs concise and avoid unsafe raw output.
- Metadata normalization aligned to scoring fields with consistent source attribution.
- OSV severity parsing hardened for structured and partial responses.
- Dependency graph identity matching tightened for direct dependency version resolution.
- Policy enforcement wiring validated for `warn_score` and `block_known_critical_vulns`.
- CLI package metadata and npm packaging flow hardened for public publishing.

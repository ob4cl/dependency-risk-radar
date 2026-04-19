# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Security and release hardening
- Path sandbox enforcement tightened for repository and policy file handling.
- Explicit policy path now fails closed on missing/unreadable/invalid files.
- GitHub Action output path hardened to keep logs concise and avoid unsafe raw output.
- Metadata normalization aligned to scoring fields with consistent source attribution.
- OSV severity parsing hardened for structured and partial responses.
- Dependency graph identity matching tightened for direct dependency version resolution.
- Policy enforcement wiring validated for `warn_score` and `block_known_critical_vulns`.
- CLI package metadata and npm packaging flow hardened for public publishing.

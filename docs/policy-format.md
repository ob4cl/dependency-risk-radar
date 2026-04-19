# Policy format

Example:

```yaml
ecosystems:
  npm:
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

The current milestone validates the schema and supports starter file generation.

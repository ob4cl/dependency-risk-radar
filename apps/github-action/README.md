# Dependency Risk Radar GitHub Action

This package wraps the local analysis engine as a GitHub Action.

## Inputs

- `repo` - repository path to analyze, default `.`
- `base` - base git ref or commit SHA
- `head` - head git ref or commit SHA
- `policy` - optional policy file path
- `format` - log format: `json`, `markdown`, or `both`
- `live-metadata` - enable provider-backed enrichment, default `false`

## Outputs

- `json`
- `markdown`
- `decision`
- `score`
- `exit-code-recommendation`

## Example usage

```yaml
name: dependency-risk-radar

on:
  pull_request:

jobs:
  radar:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Analyze dependency changes
        id: radar
        uses: ./apps/github-action
        with:
          repo: .
          base: ${{ github.event.pull_request.base.sha }}
          head: ${{ github.event.pull_request.head.sha }}
          format: markdown

      - name: Surface the result
        run: |
          echo "decision=${{ steps.radar.outputs.decision }}"
          echo "score=${{ steps.radar.outputs.score }}"
          echo "exit-code=${{ steps.radar.outputs.exit-code-recommendation }}"
```

The action stays local-first: it uses the repository checkout and the core analyzer only. No network calls are introduced by the wrapper itself.

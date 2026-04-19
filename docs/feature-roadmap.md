# Feature roadmap ideas

These are the highest-value additions that would make Dependency Risk Radar more useful in real PR reviews.

## Highest priority

1. Workspace-aware change grouping
   - collapse package-level changes into a single repo-level summary
   - highlight which workspace is driving the risk

2. Baseline compare mode
   - compare against a known-good snapshot or last release tag
   - useful for release branches and large monorepos

3. GitHub PR annotations
   - comment inline on changed dependency files
   - make risk evidence visible where reviewers already work

4. Policy presets
   - safe defaults for library repos, apps, and monorepos
   - reduce setup friction for new users

5. Better lockfile intelligence
   - detect indirect graph expansion more precisely
   - explain why transitive risk changed, not just that it changed

## Strong next-step features

6. SBOM export
   - emit SPDX or CycloneDX from the normalized dependency graph
   - useful for compliance and security workflows

7. Historical trend view
   - track risk score over time
   - help teams spot dependency hygiene regressions

8. Advisory source adapters
   - plug in OSV, npm advisories, and future metadata sources behind the provider layer
   - keep live data optional and cacheable

9. Reviewer-friendly explanations
   - summarize top evidence in one sentence
   - explain why a package moved from warn to fail

10. CI policy gates
    - fail only on policy violations, or fail on score thresholds
    - support different thresholds per branch or repo area

## Nice-to-have later

11. Allowlist / exception workflow
    - documented exceptions with expiry dates
    - prevents permanent policy drift

12. Package trust signals
    - maintainer age, publish cadence, provenance, repo health
    - all as explainable heuristics, not hidden scores

13. Rich diff visualizations
    - markdown tables are good, but graphs or trees help with large dependency jumps

14. Explain command upgrades
    - show install script risk, vulnerability history, and maintenance context for a single package

15. MCP convenience tools
    - compare two refs
    - summarize only high-risk findings
    - generate a policy from observed repo patterns

## Practical recommendation

If you want this tool to feel immediately useful, build these first:

- workspace-aware summaries
- baseline compare mode
- GitHub PR annotations
- policy presets
- better transitive graph explanations

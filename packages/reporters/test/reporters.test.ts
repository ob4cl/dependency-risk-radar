import { describe, expect, it } from 'vitest';
import { renderJsonReport, renderMarkdownReport } from '@drr/reporters';
import type { FinalAnalysisResult } from '@drr/shared';

const result: FinalAnalysisResult = {
  analysisVersion: '0.1.0',
  repoPath: '/repo',
  baseRef: 'main',
  headRef: 'head',
  generatedAt: '2026-04-19T00:00:00.000Z',
  summary: {
    totalPackagesReviewed: 1,
    changedDirectDependencies: 1,
    changedTransitiveDependencies: 1,
    criticalFindings: 0,
    highFindings: 0,
    mediumFindings: 0,
    lowFindings: 0,
    totalRiskScore: 0,
    decision: 'pass',
  },
  dependencyChanges: [],
  findings: [],
  markdownReport: '',
  policyApplied: false,
  exitCodeRecommendation: 0,
};

describe('reporters', () => {
  it('renders stable json and markdown output', () => {
    const json = renderJsonReport(result);
    const markdown = renderMarkdownReport({ ...result, markdownReport: '' });
    expect(json).toBe(`${JSON.stringify(result, null, 2)}\n`);
    expect(markdown).toBe(`# Dependency Risk Radar\n\nDecision: **pass**\nRisk score: **0**\n\n## Summary\n- Direct dependency changes: 1\n- Transitive dependency changes: 1\n- Findings: 0\n\n## Dependency changes\n- None\n\n## Findings\n- None\n`);
  });
});

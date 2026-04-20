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

  it('sanitizes control characters in markdown fields while preserving raw json output', () => {
    const escaped = {
      ...result,
      markdownReport: '',
      dependencyChanges: [
        {
          ecosystem: 'npm',
          name: 'left-pad\u001b[2J',
          changeType: 'upgraded',
          fromVersion: '1.0.0\u0007',
          toVersion: '1.1.0',
          direct: true,
          manifestPath: 'package.json',
          lockfilePath: 'pnpm-lock.yaml',
          workspace: null,
          metadata: {},
        },
      ],
      findings: [
        {
          id: 'f-1',
          category: 'policy',
          severity: 'high',
          score: 20,
          title: 'Bad\u001b[31mTitle',
          summary: 'Line one\nline two\rline three',
          evidence: ['ev\u001b[0mmarker', 'bell\u0007'],
          recommendation: 'do\u001f-this',
          package: null,
          version: null,
          direct: false,
          policySource: 'policy\u009fsource',
        },
      ],
    } satisfies FinalAnalysisResult;

    const markdown = renderMarkdownReport(escaped);
    const json = renderJsonReport(escaped);

    expect(markdown).toContain('left-pad\\u001b[2J');
    expect(markdown).toContain('(1.0.0\\u0007 → 1.1.0)');
    expect(markdown).toContain('Bad\\u001b[31mTitle');
    expect(markdown).toContain('Line one\\u000aline two\\u000dline three');
    expect(markdown).toContain('Evidence: ev\\u001b[0mmarker; bell\\u0007');
    expect(markdown).toContain('Policy: policy\\u009fsource');
    expect(markdown).toContain('Recommendation: do\\u001f-this');
    expect(markdown).not.toMatch(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/);

    expect(json).toContain('left-pad\\u001b[2J');
    expect(json).toContain('Bad\\u001b[31mTitle');
    expect(json).toContain('ev\\u001b[0mmarker');
  });
});

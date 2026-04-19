import { describe, expect, it } from 'vitest';
import { scoreDependencyChanges } from '@drr/scoring';
import type { NormalizedDependencyChange } from '@drr/shared';

const baseChange: NormalizedDependencyChange = {
  ecosystem: 'npm',
  name: 'bad-package',
  changeType: 'upgraded',
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  direct: true,
  manifestPath: '/repo/package.json',
  lockfilePath: '/repo/package-lock.json',
  workspace: 'demo',
  transitiveCountDelta: 12,
  metadata: {
    hasInstallScript: true,
    license: 'GPL-3.0',
    repository: 'https://example.com',
  },
};

describe('scoreDependencyChanges', () => {
  it('creates deterministic findings for install script, blast radius, and policy risk', () => {
    const result = scoreDependencyChanges([baseChange], {
      thresholds: { warnScore: 25, failScore: 70 },
      weights: { vulnerability: 40, installTimeExecution: 20, blastRadius: 15, maintenanceTrust: 15, policy: 10 },
      deniedPackages: ['bad-package'],
      deniedLicenses: ['GPL-3.0'],
      requireInstallScriptReview: true,
      blockKnownCriticalVulns: false,
    });

    expect(result.findings).toHaveLength(4);
    expect(result.summary.totalRiskScore).toBe(55);
    expect(result.summary.decision).toBe('high-risk');
  });

  it('fails closed when a critical vulnerability is present and policy blocks it', () => {
    const result = scoreDependencyChanges([
      {
        ...baseChange,
        name: 'critical-package',
        metadata: {
          ...baseChange.metadata,
          extra: {
            metadataSource: 'npm',
            vulnerabilities: [{ id: 'osv-1', severity: 'critical', summary: 'Critical issue' }],
          },
        },
      },
    ], {
      thresholds: { warnScore: 25, failScore: 70 },
      weights: { vulnerability: 40, installTimeExecution: 20, blastRadius: 15, maintenanceTrust: 15, policy: 10 },
      deniedPackages: [],
      deniedLicenses: [],
      requireInstallScriptReview: false,
      blockKnownCriticalVulns: true,
    });

    expect(result.findings.some((finding) => finding.category === 'known-vulnerability')).toBe(true);
    expect(result.summary.decision).toBe('fail');
  });
});

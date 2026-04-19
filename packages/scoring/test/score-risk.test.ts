import { describe, expect, it } from 'vitest';
import { scoreDependencyChanges } from '@drr/scoring';
import type { NormalizedDependencyChange } from '@drr/shared';

const change: NormalizedDependencyChange = {
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
    const result = scoreDependencyChanges([change], {
      thresholds: { warnScore: 25, failScore: 70 },
      weights: { vulnerability: 40, installTimeExecution: 20, blastRadius: 15, maintenanceTrust: 15, policy: 10 },
      deniedPackages: ['bad-package'],
      deniedLicenses: ['GPL-3.0'],
      requireInstallScriptReview: true,
    });

    expect(result.findings).toHaveLength(4);
    expect(result.summary.totalRiskScore).toBe(55);
    expect(result.summary.decision).toBe('high-risk');
  });
});

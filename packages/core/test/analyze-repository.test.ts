import { describe, expect, it } from 'vitest';
import { analyzeRepository } from '@drr/core';
import { createGitRepoFixture } from '../../../tests/helpers/git-repo';

const baseFiles = {
  'package.json': JSON.stringify({ name: 'demo', dependencies: { react: '^18.0.0' } }, null, 2),
  'package-lock.json': JSON.stringify({
    name: 'demo',
    lockfileVersion: 3,
    packages: {
      '': { dependencies: { react: '18.2.0' } },
      'node_modules/react': { name: 'react', version: '18.2.0', dependencies: { scheduler: '0.24.0' } },
      'node_modules/scheduler': { name: 'scheduler', version: '0.24.0' },
    },
  }, null, 2),
};

const headFiles = {
  'package.json': JSON.stringify({ name: 'demo', dependencies: { react: '^19.0.0' } }, null, 2),
  'package-lock.json': JSON.stringify({
    name: 'demo',
    lockfileVersion: 3,
    packages: {
      '': { dependencies: { react: '19.1.0' } },
      'node_modules/react': { name: 'react', version: '19.1.0', dependencies: { scheduler: '0.25.0', 'use-sync-external-store': '1.5.0' } },
      'node_modules/scheduler': { name: 'scheduler', version: '0.25.0' },
      'node_modules/use-sync-external-store': { name: 'use-sync-external-store', version: '1.5.0', hasInstallScript: true },
    },
  }, null, 2),
};

describe('analyzeRepository', () => {
  it('produces a deterministic final analysis result', async () => {
    const repo = createGitRepoFixture(baseFiles, headFiles);
    const result = await analyzeRepository({ repoPath: repo.repoPath, baseRef: repo.baseRef, headRef: repo.headRef, allowedWorkspaceRoot: repo.repoPath, allowedConfigRoot: repo.repoPath });
    expect(result.dependencyChanges).toHaveLength(1);
    expect(result.dependencyChanges[0]?.name).toBe('react');
    expect(result.markdownReport).toContain('Dependency Risk Radar');
    expect(result.summary.decision).toBe('pass');
  });
});

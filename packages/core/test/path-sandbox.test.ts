import { mkdtempSync, symlinkSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
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
      'node_modules/react': { name: 'react', version: '18.2.0' },
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
      'node_modules/react': { name: 'react', version: '19.1.0' },
    },
  }, null, 2),
};

describe('path sandboxing', () => {
  it('rejects repo paths outside the allowed workspace root', async () => {
    const repo = createGitRepoFixture(baseFiles, headFiles);
    const sandboxRoot = mkdtempSync(join(tmpdir(), 'drr-sandbox-'));

    await expect(analyzeRepository({
      repoPath: repo.repoPath,
      baseRef: repo.baseRef,
      headRef: repo.headRef,
      allowedWorkspaceRoot: sandboxRoot,
      allowedConfigRoot: sandboxRoot,
    })).rejects.toMatchObject({ code: 'PATH_OUTSIDE_ALLOWED_ROOT' });
  });

  it('rejects symlink escapes for repo paths', async () => {
    const sandboxRoot = mkdtempSync(join(tmpdir(), 'drr-sandbox-'));
    const repo = createGitRepoFixture(baseFiles, headFiles);
    const linkedRepoPath = join(sandboxRoot, 'repo');
    symlinkSync(repo.repoPath, linkedRepoPath, 'dir');

    await expect(analyzeRepository({
      repoPath: linkedRepoPath,
      baseRef: repo.baseRef,
      headRef: repo.headRef,
      allowedWorkspaceRoot: sandboxRoot,
      allowedConfigRoot: sandboxRoot,
    })).rejects.toMatchObject({ code: 'SYMLINK_ESCAPE' });
  });

  it('fails closed on a missing explicit policy file', async () => {
    const repo = createGitRepoFixture(baseFiles, headFiles);

    await expect(analyzeRepository({
      repoPath: repo.repoPath,
      baseRef: repo.baseRef,
      headRef: repo.headRef,
      policyPath: join(repo.repoPath, 'dependency-risk-radar.yaml'),
      allowedWorkspaceRoot: repo.repoPath,
      allowedConfigRoot: repo.repoPath,
    })).rejects.toMatchObject({ code: 'PATH_NOT_FOUND' });
  });

  it('rejects an unreadable explicit policy file', async () => {
    const repo = createGitRepoFixture(baseFiles, headFiles);
    const policyPath = join(repo.repoPath, 'dependency-risk-radar.yaml');
    writeFileSync(policyPath, 'ecosystems:\n  npm:\n    enabled: true\n');
    chmodSync(policyPath, 0o000);

    await expect(analyzeRepository({
      repoPath: repo.repoPath,
      baseRef: repo.baseRef,
      headRef: repo.headRef,
      policyPath,
      allowedWorkspaceRoot: repo.repoPath,
      allowedConfigRoot: repo.repoPath,
    })).rejects.toMatchObject({ code: 'PATH_UNREADABLE' });
  });

  it('rejects an invalid explicit policy file', async () => {
    const repo = createGitRepoFixture(baseFiles, headFiles);
    const policyPath = join(repo.repoPath, 'dependency-risk-radar.yaml');
    writeFileSync(policyPath, 'ecosystems:\n  npm:\n    enabled: [');

    await expect(analyzeRepository({
      repoPath: repo.repoPath,
      baseRef: repo.baseRef,
      headRef: repo.headRef,
      policyPath,
      allowedWorkspaceRoot: repo.repoPath,
      allowedConfigRoot: repo.repoPath,
    })).rejects.toMatchObject({ code: 'POLICY_VALIDATION_ERROR' });
  });

  it('rejects a policy file outside the allowed roots', async () => {
    const repo = createGitRepoFixture(baseFiles, headFiles);
    const sandboxRoot = mkdtempSync(join(tmpdir(), 'drr-sandbox-'));
    const outsidePolicy = join(tmpdir(), 'drr-policy-outside.yaml');
    writeFileSync(outsidePolicy, 'thresholds:\n  block_score: 70\n');

    await expect(analyzeRepository({
      repoPath: repo.repoPath,
      baseRef: repo.baseRef,
      headRef: repo.headRef,
      policyPath: outsidePolicy,
      allowedWorkspaceRoot: sandboxRoot,
      allowedConfigRoot: sandboxRoot,
    })).rejects.toMatchObject({ code: 'PATH_OUTSIDE_ALLOWED_ROOT' });
  });

  it('rejects explicit policy files from workspace root unless explicitly allowed as config root', async () => {
    const repo = createGitRepoFixture(baseFiles, headFiles);
    const workspaceRoot = dirname(repo.repoPath);
    const workspacePolicy = join(workspaceRoot, `dependency-risk-radar-${Date.now()}.yaml`);
    writeFileSync(workspacePolicy, 'thresholds:\n  block_score: 70\n');

    await expect(analyzeRepository({
      repoPath: repo.repoPath,
      baseRef: repo.baseRef,
      headRef: repo.headRef,
      policyPath: workspacePolicy,
      allowedWorkspaceRoot: workspaceRoot,
    })).rejects.toMatchObject({ code: 'PATH_OUTSIDE_ALLOWED_ROOT' });

    await expect(analyzeRepository({
      repoPath: repo.repoPath,
      baseRef: repo.baseRef,
      headRef: repo.headRef,
      policyPath: workspacePolicy,
      allowedWorkspaceRoot: workspaceRoot,
      allowedConfigRoot: workspaceRoot,
    })).resolves.toMatchObject({ policyApplied: true });
  });
});

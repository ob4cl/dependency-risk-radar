import { describe, expect, it } from 'vitest';
import { analyzeRepository } from '@drr/core';
import { createGitRepoFixture } from '../../../tests/helpers/git-repo';

describe('analyzeRepository missing lockfile', () => {
  it('fails with a clear lockfile error when neither ref has a supported lockfile', async () => {
    const repo = createGitRepoFixture(
      { 'package.json': JSON.stringify({ name: 'demo', dependencies: { react: '^18.0.0' } }, null, 2) },
      { 'package.json': JSON.stringify({ name: 'demo', dependencies: { react: '^19.0.0' } }, null, 2) },
    );

    await expect(analyzeRepository({ repoPath: repo.repoPath, baseRef: repo.baseRef, headRef: repo.headRef, allowedWorkspaceRoot: repo.repoPath, allowedConfigRoot: repo.repoPath })).rejects.toThrow(/No supported lockfile/);
  });
});

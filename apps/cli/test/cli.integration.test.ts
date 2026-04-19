import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { createGitRepoFixture } from '../../../tests/helpers/git-repo';

const repoRoot = '/home/tyler/.openclaw/workspace/drr';

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

function runCli(args: string[]) {
  return spawnSync(process.execPath, ['--import', 'tsx', 'apps/cli/src/cli.ts', ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

describe('radar cli analyze', () => {
  it('prints json only when requested', () => {
    const repo = createGitRepoFixture(baseFiles, headFiles);
    const result = runCli(['analyze', '--repo', repo.repoPath, '--base', repo.baseRef, '--head', repo.headRef, '--format', 'json']);
    expect(result.status).toBe(0);
    expect(result.stdout.trim().startsWith('{')).toBe(true);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.markdownReport).toContain('# Dependency Risk Radar');
  });

  it('prints markdown only when requested', () => {
    const repo = createGitRepoFixture(baseFiles, headFiles);
    const result = runCli(['analyze', '--repo', repo.repoPath, '--base', repo.baseRef, '--head', repo.headRef, '--format', 'markdown']);
    expect(result.status).toBe(0);
    expect(result.stdout.trim().startsWith('# Dependency Risk Radar')).toBe(true);
    expect(result.stdout).not.toContain('"analysisVersion"');
  });

  it('returns a stable error code for invalid refs', () => {
    const repo = createGitRepoFixture(baseFiles, headFiles);
    const result = runCli(['analyze', '--repo', repo.repoPath, '--base', 'missing-base', '--head', repo.headRef, '--format', 'json']);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Invalid git reference');
  });
});

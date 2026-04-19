import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export interface GitRepoFixture {
  repoPath: string;
  baseRef: string;
  headRef: string;
}

function writeTree(root: string, files: Record<string, string>): void {
  const entries = Object.entries(files).sort(([left], [right]) => left.localeCompare(right));
  for (const [relativePath, content] of entries) {
    const target = join(root, relativePath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, 'utf8');
  }
}

function git(repoPath: string, args: string[]): string {
  return execFileSync('git', args, { cwd: repoPath, encoding: 'utf8' }).trim();
}

export function createGitRepoFixture(baseFiles: Record<string, string>, headFiles: Record<string, string>): GitRepoFixture {
  const repoPath = mkdtempSync(join(tmpdir(), 'drr-fixture-'));
  git(repoPath, ['init', '-b', 'main']);
  git(repoPath, ['config', 'user.email', 'radar@example.com']);
  git(repoPath, ['config', 'user.name', 'Dependency Risk Radar']);

  writeTree(repoPath, baseFiles);
  git(repoPath, ['add', '.']);
  git(repoPath, ['commit', '-m', 'base']);

  git(repoPath, ['checkout', '-b', 'head']);
  writeTree(repoPath, headFiles);
  git(repoPath, ['add', '.']);
  git(repoPath, ['commit', '-m', 'head']);

  return { repoPath, baseRef: 'main', headRef: 'head' };
}

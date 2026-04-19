import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = '/home/tyler/.openclaw/workspace/drr';
const packageRoot = join(repoRoot, 'apps/cli');
const distDir = join(packageRoot, 'dist');
const packageJsonPath = join(packageRoot, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version: string; name: string };

function run(command: string, args: string[], cwd: string) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
  });
}

function buildPackage(): void {
  rmSync(distDir, { recursive: true, force: true });
  const result = run('corepack', ['pnpm', 'build'], packageRoot);
  expect(result.status, result.stderr || result.stdout).toBe(0);
}

function collectTreeHash(root: string): string {
  const hash = createHash('sha256');

  function visit(directory: string, relativePrefix: string): void {
    const entries = readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const relativePath = relativePrefix ? join(relativePrefix, entry.name) : entry.name;
      const absolutePath = join(directory, entry.name);

      if (entry.isDirectory()) {
        visit(absolutePath, relativePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      hash.update(relativePath);
      hash.update('\0');
      hash.update(readFileSync(absolutePath));
      hash.update('\0');
    }
  }

  visit(root, '');
  return hash.digest('hex');
}

describe('apps/cli packaging', () => {
  it('builds a deterministic dist tree', () => {
    buildPackage();
    const firstHash = collectTreeHash(distDir);
    const firstBundle = readFileSync(join(distDir, 'cli.cjs'), 'utf8');

    buildPackage();
    const secondHash = collectTreeHash(distDir);

    expect(firstBundle.startsWith('#!/usr/bin/env node')).toBe(true);
    expect(firstHash).toBe(secondHash);
    expect(readdirSync(distDir).sort()).toEqual(['cli.cjs']);
  }, 20000);

  it('packs the built entrypoint and package metadata', () => {
    buildPackage();

    const result = run('npm', ['pack', '--dry-run', '--json'], packageRoot);
    expect(result.status, result.stderr || result.stdout).toBe(0);

    const [pack] = JSON.parse(result.stdout) as Array<{
      id: string;
      name: string;
      version: string;
      filename: string;
      entryCount: number;
      files: Array<{ path: string }>;
    }>;

    if (!pack) {
      throw new Error('Expected npm pack output');
    }

    const packInfo = pack;

    const packedFiles = packInfo.files.map((file) => file.path).sort();

    expect(packInfo.id).toBe(`dradar@${packageJson.version}`);
    expect(packInfo.name).toBe('dradar');
    expect(packInfo.version).toBe(packageJson.version);
    expect(packInfo.filename).toBe(`dradar-${packageJson.version}.tgz`);
    expect(packInfo.entryCount).toBe(4);
    expect(packedFiles).toEqual(['README.md', 'bin/radar', 'dist/cli.cjs', 'package.json']);
    expect(packedFiles).not.toContain('src/cli.ts');
    expect(packedFiles).not.toContain('test/cli.integration.test.ts');
  }, 20000);

  it('installs and runs from the packed tarball in a clean temp directory', () => {
    buildPackage();

    const packResult = run('npm', ['pack'], packageRoot);
    expect(packResult.status, packResult.stderr || packResult.stdout).toBe(0);

    const tarballLines = packResult.stdout.trim().split(/\r?\n/).filter((line) => line.trim().length > 0);
    const tarball = tarballLines[tarballLines.length - 1];
    if (!tarball) {
      throw new Error('Expected npm pack to output a tarball filename');
    }

    const installRoot = mkdtempSync(join(tmpdir(), 'drr-pack-install-'));
    const initResult = run('npm', ['init', '-y'], installRoot);
    expect(initResult.status, initResult.stderr || initResult.stdout).toBe(0);

    const installResult = run('npm', ['install', join(packageRoot, tarball)], installRoot);
    expect(installResult.status, installResult.stderr || installResult.stdout).toBe(0);

    const helpResult = run('npx', ['--yes', 'radar', '--help'], installRoot);
    expect(helpResult.status, helpResult.stderr || helpResult.stdout).toBe(0);
    expect(helpResult.stdout).toContain('Dependency Risk Radar');

    rmSync(join(packageRoot, tarball), { force: true });
    rmSync(installRoot, { recursive: true, force: true });
  }, 30000);

  it('points the CLI bin at the built JavaScript entrypoint', () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      bin: Record<string, string>;
      main: string;
      dependencies?: Record<string, string>;
    };

    expect(packageJson.bin).toEqual({ radar: './bin/radar' });
    expect(packageJson.main).toBe('./dist/cli.cjs');
    expect(packageJson.main.endsWith('.ts')).toBe(false);
    expect(packageJson.dependencies).toEqual({ commander: '^12.1.0' });
  });
});

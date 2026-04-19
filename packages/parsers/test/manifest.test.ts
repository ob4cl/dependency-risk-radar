import { describe, expect, it } from 'vitest';
import { inferEcosystemFromPackageManager, parsePackageJson } from '@drr/parsers';

const manifest = JSON.stringify({
  name: 'demo',
  version: '1.0.0',
  packageManager: 'pnpm@10.33.0',
  workspaces: ['apps/*', 'packages/*'],
  dependencies: { react: '^19.0.0' },
  devDependencies: { vitest: '^3.2.4' },
  optionalDependencies: { fsevents: '^2.3.3' },
  peerDependencies: { typescript: '^5.9.2' },
  repository: { url: 'https://github.com/example/demo.git' },
  license: 'MIT',
  homepage: 'https://example.com',
  description: 'demo app',
});

describe('parsePackageJson', () => {
  it('normalizes dependency groups and metadata', () => {
    const parsed = parsePackageJson(manifest, '/repo/package.json');
    expect(parsed.ecosystem).toBe('npm');
    expect(parsed.name).toBe('demo');
    expect(parsed.packageManager).toBe('pnpm@10.33.0');
    expect(parsed.metadata.workspaces).toEqual(['apps/*', 'packages/*']);
    expect(parsed.metadata.repository).toBe('https://github.com/example/demo.git');
    expect(parsed.dependencies).toMatchObject({ react: '^19.0.0', vitest: '^3.2.4', fsevents: '^2.3.3', typescript: '^5.9.2' });
  });

  it('rejects invalid json', () => {
    expect(() => parsePackageJson('{', '/repo/package.json')).toThrow(/Invalid package.json/);
  });
});

describe('inferEcosystemFromPackageManager', () => {
  it('detects pnpm', () => {
    expect(inferEcosystemFromPackageManager('pnpm@10.33.0')).toBe('pnpm');
  });

  it('rejects unknown managers', () => {
    expect(() => inferEcosystemFromPackageManager('bun@1')).toThrow(/Unsupported ecosystem/);
  });
});

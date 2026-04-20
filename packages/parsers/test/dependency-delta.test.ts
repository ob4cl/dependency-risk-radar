import { describe, expect, it } from 'vitest';
import { generateDependencyDelta, parseLockfile, parsePackageJson } from '@drr/parsers';

const baseManifest = parsePackageJson(JSON.stringify({ name: 'demo', dependencies: { react: '^18.0.0' } }), '/repo/package.json');
const headManifest = parsePackageJson(JSON.stringify({ name: 'demo', dependencies: { react: '^19.0.0' } }), '/repo/package.json');

const baseLock = parseLockfile(JSON.stringify({
  name: 'demo',
  lockfileVersion: 3,
  packages: {
    '': { dependencies: { react: '18.2.0', a: '1.0.0' } },
    'node_modules/react': { name: 'react', version: '18.2.0', dependencies: { scheduler: '0.24.0' } },
    'node_modules/a': { name: 'a', version: '1.0.0', dependencies: { react: '18.2.0' } },
    'node_modules/a/node_modules/react': { name: 'react', version: '18.2.0' },
    'node_modules/scheduler': { name: 'scheduler', version: '0.24.0' },
  },
}), '/repo/package-lock.json');

const headLock = parseLockfile(JSON.stringify({
  name: 'demo',
  lockfileVersion: 3,
  packages: {
    '': { dependencies: { react: '19.1.0', a: '1.0.0' } },
    'node_modules/react': { name: 'react', version: '19.1.0', dependencies: { scheduler: '0.25.0' } },
    'node_modules/a': { name: 'a', version: '1.0.0', dependencies: { react: '18.2.0' } },
    'node_modules/a/node_modules/react': { name: 'react', version: '18.2.0' },
    'node_modules/scheduler': { name: 'scheduler', version: '0.25.0' },
  },
}), '/repo/package-lock.json');

function createDeepChainLock(depth: number) {
  const packages: Record<string, { name?: string; version?: string; dependencies?: Record<string, string> }> = {
    '': { dependencies: { 'deep-root': '1.0.0' } },
    'node_modules/deep-root': { name: 'deep-root', version: '1.0.0' },
  };

  if (depth > 0) {
    packages['node_modules/deep-root'] = {
      name: 'deep-root',
      version: '1.0.0',
      dependencies: { 'deep-node-1': '1.0.0' },
    };
  }

  for (let index = 1; index <= depth; index += 1) {
    packages[`node_modules/deep-node-${index}`] = {
      name: `deep-node-${index}`,
      version: '1.0.0',
      dependencies: index < depth ? { [`deep-node-${index + 1}`]: '1.0.0' } : undefined,
    };
  }

  return parseLockfile(JSON.stringify({
    name: 'demo',
    lockfileVersion: 3,
    packages,
  }), '/repo/package-lock.json');
}

describe('generateDependencyDelta', () => {
  it('normalizes upgrades using the exact root lockfile identity', () => {
    const changes = generateDependencyDelta({ base: { manifest: baseManifest, lockfile: baseLock }, head: { manifest: headManifest, lockfile: headLock } });
    expect(changes).toHaveLength(1);
    expect(changes[0]?.name).toBe('react');
    expect(changes[0]?.fromVersion).toBe('18.2.0');
    expect(changes[0]?.toVersion).toBe('19.1.0');
    expect(changes[0]?.changeType).toBe('upgraded');
    expect(changes[0]?.transitiveCountDelta).toBe(0);
  });

  it('handles deep dependency chains without recursive traversal', () => {
    const depth = 15_000;
    const manifest = parsePackageJson(JSON.stringify({ name: 'demo', dependencies: { 'deep-root': '^1.0.0' } }), '/repo/package.json');
    const shallowLock = createDeepChainLock(0);
    const deepLock = createDeepChainLock(depth);

    const changes = generateDependencyDelta({
      base: { manifest, lockfile: shallowLock },
      head: { manifest, lockfile: deepLock },
    });

    expect(changes).toHaveLength(1);
    expect(changes[0]?.name).toBe('deep-root');
    expect(changes[0]?.changeType).toBe('unchanged');
    expect(changes[0]?.transitiveCountDelta).toBe(depth);
  });
});

import { describe, expect, it } from 'vitest';
import { generateDependencyDelta, parseLockfile, parsePackageJson } from '@drr/parsers';

const baseManifest = parsePackageJson(JSON.stringify({ name: 'demo', dependencies: { react: '^18.0.0' } }), '/repo/package.json');
const headManifest = parsePackageJson(JSON.stringify({ name: 'demo', dependencies: { react: '^19.0.0' } }), '/repo/package.json');

const baseLock = parseLockfile(JSON.stringify({
  name: 'demo',
  lockfileVersion: 3,
  packages: {
    '': { dependencies: { react: '18.2.0' } },
    'node_modules/react': { name: 'react', version: '18.2.0', dependencies: { scheduler: '0.24.0' } },
    'node_modules/scheduler': { name: 'scheduler', version: '0.24.0' },
  },
}), '/repo/package-lock.json');

const headLock = parseLockfile(JSON.stringify({
  name: 'demo',
  lockfileVersion: 3,
  packages: {
    '': { dependencies: { react: '19.1.0' } },
    'node_modules/react': { name: 'react', version: '19.1.0', dependencies: { scheduler: '0.25.0', 'use-sync-external-store': '1.5.0' } },
    'node_modules/scheduler': { name: 'scheduler', version: '0.25.0' },
    'node_modules/use-sync-external-store': { name: 'use-sync-external-store', version: '1.5.0' },
  },
}), '/repo/package-lock.json');

describe('generateDependencyDelta', () => {
  it('normalizes upgrades and transitive graph growth', () => {
    const changes = generateDependencyDelta({ base: { manifest: baseManifest, lockfile: baseLock }, head: { manifest: headManifest, lockfile: headLock } });
    expect(changes).toHaveLength(1);
    expect(changes[0]?.name).toBe('react');
    expect(changes[0]?.changeType).toBe('upgraded');
    expect(changes[0]?.transitiveCountDelta).toBeGreaterThan(0);
  });
});

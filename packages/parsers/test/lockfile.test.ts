import { describe, expect, it } from 'vitest';
import { parseLockfile } from '@drr/parsers';

const packageLock = JSON.stringify({
  name: 'demo',
  lockfileVersion: 3,
  packages: {
    '': { dependencies: { react: '19.1.0', '@scope/pkg': '1.2.3' } },
    'node_modules/react': { name: 'react', version: '19.1.0', dependencies: { scheduler: '0.25.0' } },
    'node_modules/@scope/pkg': { version: '1.2.3', dependencies: { react: '19.1.0' } },
    'node_modules/scheduler': { name: 'scheduler', version: '0.25.0', hasInstallScript: true },
  },
});

const pnpmLock = `lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      react: 19.1.0
packages:
  /react@19.1.0:
    dependencies:
      scheduler: 0.25.0
  /scheduler@0.25.0:
    hasInstallScript: true
`;

describe('parseLockfile', () => {
  it('parses package-lock.json', () => {
    const parsed = parseLockfile(packageLock, '/repo/package-lock.json');
    expect(parsed.kind).toBe('package-lock');
    expect(parsed.rootDependencies.react).toBe('19.1.0');
    expect(parsed.packages.get('node_modules/scheduler')?.hasInstallScript).toBe(true);
  });

  it('parses pnpm-lock.yaml', () => {
    const parsed = parseLockfile(pnpmLock, '/repo/pnpm-lock.yaml');
    expect(parsed.kind).toBe('pnpm-lock');
    expect(parsed.rootDependencies.react).toBe('19.1.0');
    expect(parsed.packages.get('/scheduler@0.25.0')?.hasInstallScript).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { MalformedInputError } from '@drr/shared';
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

  it('rejects oversized package-lock.json input', () => {
    const oversizedPackageLock = JSON.stringify({
      name: 'demo',
      lockfileVersion: 3,
      packages: {},
      padding: 'x'.repeat(10 * 1024 * 1024 + 1),
    });

    expect(() => parseLockfile(oversizedPackageLock, '/repo/package-lock.json')).toThrowError(MalformedInputError);

    try {
      parseLockfile(oversizedPackageLock, '/repo/package-lock.json');
    } catch (error) {
      expect(error).toBeInstanceOf(MalformedInputError);
      expect((error as MalformedInputError).details).toMatchObject({
        path: '/repo/package-lock.json',
        actualSizeBytes: expect.any(Number),
        maxSizeBytes: expect.any(Number),
      });
    }
  });

  it('rejects pnpm lockfiles that use YAML aliases', () => {
    const aliasLock = `lockfileVersion: '9.0'
importers:
  .:
    dependencies: &deps
      react: 19.1.0
packages:
  /react@19.1.0: *deps
`;

    expect(() => parseLockfile(aliasLock, '/repo/pnpm-lock.yaml')).toThrowError(MalformedInputError);
  });

  it('rejects excessive pnpm package entries', () => {
    const path = '/repo/pnpm-lock.yaml';
    const text = `lockfileVersion: '9.0'\nimporters:\n  .:\n    dependencies: {}\npackages:\n${Array.from({ length: 8_001 }, (_, index) => `  /p${index}@1: {}`).join('\n')}\n`;

    expect(() => parseLockfile(text, path)).toThrowError(MalformedInputError);

    try {
      parseLockfile(text, path);
    } catch (error) {
      expect(error).toBeInstanceOf(MalformedInputError);
      expect((error as MalformedInputError).details).toMatchObject({
        path,
        packageEntryCount: expect.any(Number),
      });
    }
  }, 15_000);

  it.each([
    {
      name: 'package-lock package entries',
      path: '/repo/package-lock.json',
      text: JSON.stringify({
        name: 'demo',
        lockfileVersion: 3,
        packages: Object.fromEntries([
          ['', { dependencies: {} }],
          ...Array.from({ length: 20_001 }, (_, index) => [`node_modules/pkg-${index}`, { name: `pkg-${index}`, version: '1.0.0' }]),
        ]),
      }),
      expectedDetail: 'packageEntryCount',
    },
    {
      name: 'pnpm importer entries',
      path: '/repo/pnpm-lock.yaml',
      text: `lockfileVersion: '9.0'\nimporters:\n${Array.from({ length: 1_001 }, (_, index) => `  packages/pkg-${index}:\n    dependencies: {}`).join('\n')}\npackages: {}\n`,
      expectedDetail: 'importerEntryCount',
    },
  ])('rejects excessive $name', ({ path, text, expectedDetail }) => {
    expect(() => parseLockfile(text, path)).toThrowError(MalformedInputError);

    try {
      parseLockfile(text, path);
    } catch (error) {
      expect(error).toBeInstanceOf(MalformedInputError);
      expect((error as MalformedInputError).details).toMatchObject({
        path,
        [expectedDetail]: expect.any(Number),
      });
    }
  });
});

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { MemoryCache } from '@drr/providers';
import { NpmRegistryMetadataProvider } from '@drr/providers';
import { OsvVulnerabilityProvider } from '@drr/providers';
import { createOfflineProviderBundle, enrichDependencyChanges } from '@drr/providers';
import type { NormalizedDependencyChange } from '@drr/shared';

const originalFetch = globalThis.fetch;

describe('MemoryCache', () => {
  it('returns cached values until expiration', () => {
    const now = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const cache = new MemoryCache<number>(1000);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
    vi.setSystemTime(now + 1001);
    expect(cache.get('a')).toBeUndefined();
    vi.useRealTimers();
  });
});

describe('NpmRegistryMetadataProvider', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        'dist-tags': { latest: '1.2.3' },
        '1.2.3': {
          version: '1.2.3',
          license: 'MIT',
          repository: { url: 'https://github.com/example/pkg.git' },
          homepage: 'https://example.com',
          description: 'demo package',
        },
      }),
    })) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('normalizes registry metadata', async () => {
    const provider = new NpmRegistryMetadataProvider(10);
    const metadata = await provider.getPackageMetadata('example-pkg', '1.2.3');
    expect(metadata?.packageName).toBe('example-pkg');
    expect(metadata?.license).toBe('MIT');
    expect(metadata?.repository).toBe('https://github.com/example/pkg.git');
  });
});

describe('OsvVulnerabilityProvider', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        vulns: [
          {
            id: 'OSV-1',
            summary: 'demo vuln',
            details: 'details',
            aliases: ['CVE-1', 'CVE-1'],
            severity: [{ type: 'HIGH' }],
            references: [{ url: 'https://example.com/advisory' }],
          },
        ],
      }),
    })) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('normalizes advisory metadata', async () => {
    const provider = new OsvVulnerabilityProvider(10);
    const vulns = await provider.getVulnerabilities('example-pkg', '1.2.3');
    expect(vulns).toHaveLength(1);
    expect(vulns[0]?.id).toBe('OSV-1');
    expect(vulns[0]?.severity).toBe('high');
    expect(vulns[0]?.references).toEqual(['https://example.com/advisory']);
  });
});

describe('enrichDependencyChanges', () => {
  it('keeps results unchanged with offline providers', async () => {
    const change: NormalizedDependencyChange = {
      ecosystem: 'npm',
      name: 'react',
      changeType: 'upgraded',
      fromVersion: '18.2.0',
      toVersion: '19.1.0',
      direct: true,
      manifestPath: '/repo/package.json',
      lockfilePath: '/repo/package-lock.json',
      workspace: 'demo',
      metadata: {},
    };

    const result = await enrichDependencyChanges([change], createOfflineProviderBundle());
    expect(result).toEqual([change]);
  });
});

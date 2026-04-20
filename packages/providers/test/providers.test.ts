import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { MemoryCache } from '@drr/providers';
import { NpmRegistryMetadataProvider } from '@drr/providers';
import { OsvVulnerabilityProvider } from '@drr/providers';
import { enrichDependencyChanges } from '@drr/providers';
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
    expect(metadata?.homepage).toBe('https://example.com');
    expect(metadata?.description).toBe('demo package');
  });
});

describe('OsvVulnerabilityProvider', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async (_url: any, init?: any) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { version?: string | null };
      const version = body.version ?? 'latest';
      const severityByVersion: Record<string, unknown> = {
        'critical': [{ type: 'CVSS_V3', score: '9.8' }],
        'high': [{ type: 'HIGH' }],
        'moderate': [{ severity: 'MODERATE' }],
        'low': [{ score: '2.5' }],
        'vector-critical': [{ type: 'CVSS_V3', score: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' }],
        'vector-high': [{ type: 'CVSS_V3', score: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H' }],
        'vector-v4-critical': [{ type: 'CVSS_V4', score: 'CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:H/SI:H/SA:H/BS:9.3' }],
        'unknown': [{ type: 'CVSS_V3', score: 'CVSS:3.1/AV:X/AC:L' }],
      };
      return {
        ok: true,
        json: async () => ({
          vulns: [
            {
              id: `OSV-${version}`,
              summary: 'demo vuln',
              details: 'details',
              aliases: ['CVE-1', 'CVE-1'],
              severity: severityByVersion[version] ?? severityByVersion.unknown,
              references: [{ url: 'https://example.com/advisory' }],
            },
          ],
        }),
      } as any;
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it.each([
    ['critical', 'critical'],
    ['high', 'high'],
    ['moderate', 'moderate'],
    ['low', 'low'],
    ['vector-critical', 'critical'],
    ['vector-high', 'high'],
    ['vector-v4-critical', 'critical'],
    ['unknown', 'unknown'],
  ] as const)('normalizes %s severity responses', async (version, expected) => {
    const provider = new OsvVulnerabilityProvider(10);
    const vulns = await provider.getVulnerabilities(`example-pkg-${version}`, version);
    expect(vulns).toHaveLength(1);
    expect(vulns[0]?.id).toBe(`OSV-${version}`);
    expect(vulns[0]?.severity).toBe(expected);
    expect(vulns[0]?.references).toEqual(['https://example.com/advisory']);
  });
});

describe('enrichDependencyChanges', () => {
  it('normalizes provider metadata onto top-level fields and keeps raw payloads under extra', async () => {
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

    const result = await enrichDependencyChanges([change], {
      metadata: {
        getPackageMetadata: async () => ({
          ecosystem: 'npm',
          packageName: 'react',
          version: '19.1.0',
          license: 'MIT',
          repository: 'https://github.com/facebook/react',
          homepage: 'https://react.dev',
          description: 'React',
          source: 'npm',
          raw: {
            name: 'react',
            homepage: 'https://react.dev',
          },
        }),
      },
      vulnerabilities: {
        getVulnerabilities: async () => ([{
          id: 'OSV-1',
          summary: 'demo vuln',
          details: null,
          severity: 'high',
          aliases: [],
          references: [],
          packageName: 'react',
          version: '19.1.0',
          ecosystem: 'npm',
        }]),
      },
    });

    expect(result[0]?.metadata.license).toBe('MIT');
    expect(result[0]?.metadata.repository).toBe('https://github.com/facebook/react');
    expect(result[0]?.metadata.homepage).toBe('https://react.dev');
    expect(result[0]?.metadata.description).toBe('React');
    expect(result[0]?.metadata.extra).toMatchObject({
      metadataSource: 'npm',
      vulnerabilityCount: 1,
      providerMetadataRaw: {
        name: 'react',
      },
      registry: {
        license: 'MIT',
        repository: 'https://github.com/facebook/react',
      },
    });
  });
});

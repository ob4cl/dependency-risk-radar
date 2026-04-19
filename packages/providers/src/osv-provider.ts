import type { ProviderEcosystem, ProviderVulnerability, VulnerabilityProvider } from './types';
import { fetchJson, stableUnique } from './utils';
import { MemoryCache } from './cache';

function mapEcosystem(ecosystem: ProviderEcosystem): 'npm' {
  return 'npm';
}

function normalizeSeverity(value: unknown): ProviderVulnerability['severity'] {
  if (value === 'CRITICAL') return 'critical';
  if (value === 'HIGH') return 'high';
  if (value === 'MODERATE' || value === 'MEDIUM') return 'moderate';
  if (value === 'LOW') return 'low';
  return 'unknown';
}

export class OsvVulnerabilityProvider implements VulnerabilityProvider {
  private readonly cache = new MemoryCache<ProviderVulnerability[]>();

  constructor(private readonly timeoutMs = 5_000) {}

  async getVulnerabilities(packageName: string, version?: string | null, ecosystem: ProviderEcosystem = 'npm'): Promise<ProviderVulnerability[]> {
    const cacheKey = `${ecosystem}:${packageName}:${version ?? 'latest'}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) return cached;

    const body = {
      package: {
        ecosystem: mapEcosystem(ecosystem),
        name: packageName,
      },
      version: version ?? undefined,
    };

    const response = await fetchJson('https://api.osv.dev/v1/query', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }, this.timeoutMs);

    if (!response || typeof response !== 'object') {
      this.cache.set(cacheKey, []);
      return [];
    }

    const vulns = Array.isArray((response as Record<string, unknown>)['vulns']) ? (response as Record<string, unknown>)['vulns'] as unknown[] : [];
    const normalized = vulns
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const vuln = entry as Record<string, unknown>;
        const aliases = Array.isArray(vuln['aliases']) ? stableUnique(vuln['aliases'].filter((value): value is string => typeof value === 'string')) : [];
        const references = Array.isArray(vuln['references'])
          ? stableUnique(vuln['references']
              .map((reference) => {
                if (!reference || typeof reference !== 'object') return null;
                const url = (reference as Record<string, unknown>)['url'];
                return typeof url === 'string' ? url : null;
              })
              .filter((value): value is string => typeof value === 'string'))
          : [];
        return {
          id: typeof vuln['id'] === 'string' ? vuln['id'] : `${packageName}@${version ?? 'latest'}`,
          summary: typeof vuln['summary'] === 'string' ? vuln['summary'] : 'Vulnerability metadata unavailable',
          details: typeof vuln['details'] === 'string' ? vuln['details'] : null,
          severity: normalizeSeverity(Array.isArray(vuln['severity']) && vuln['severity'][0] && typeof vuln['severity'][0] === 'object' ? (vuln['severity'][0] as Record<string, unknown>)['type'] : vuln['severity']),
          aliases,
          references,
          packageName,
          version: version ?? null,
          ecosystem,
        } satisfies ProviderVulnerability;
      })
      .filter((value): value is ProviderVulnerability => value !== null)
      .sort((left, right) => left.id.localeCompare(right.id));

    this.cache.set(cacheKey, normalized);
    return normalized;
  }
}

import type { ProviderEcosystem, ProviderVulnerability, VulnerabilityProvider } from './types';
import { fetchJson, stableUnique } from './utils';
import { MemoryCache } from './cache';

function mapEcosystem(ecosystem: ProviderEcosystem): 'npm' {
  return 'npm';
}

function severityFromNumericScore(score: number): ProviderVulnerability['severity'] {
  if (score >= 9) return 'critical';
  if (score >= 7) return 'high';
  if (score >= 4) return 'moderate';
  if (score > 0) return 'low';
  return 'unknown';
}

function normalizeSeverityLabel(value: unknown): ProviderVulnerability['severity'] {
  if (typeof value !== 'string') {
    return 'unknown';
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'critical') return 'critical';
  if (normalized === 'high') return 'high';
  if (normalized === 'moderate' || normalized === 'medium') return 'moderate';
  if (normalized === 'low') return 'low';
  return 'unknown';
}

function normalizeSeverityEntry(entry: unknown): ProviderVulnerability['severity'] {
  if (typeof entry === 'string') {
    return normalizeSeverityLabel(entry);
  }

  if (Array.isArray(entry)) {
    for (const nested of entry) {
      const severity = normalizeSeverityEntry(nested);
      if (severity !== 'unknown') {
        return severity;
      }
    }
    return 'unknown';
  }

  if (!entry || typeof entry !== 'object') {
    return 'unknown';
  }

  const record = entry as Record<string, unknown>;
  const directFields = [record['severity'], record['type'], record['score'], record['value']];
  for (const field of directFields) {
    const normalized = normalizeSeverityEntry(field);
    if (normalized !== 'unknown') {
      return normalized;
    }
    if (typeof field === 'string') {
      const numeric = Number(field);
      if (Number.isFinite(numeric) && numeric > 0) {
        return severityFromNumericScore(numeric);
      }
    }
  }

  return 'unknown';
}

function normalizeSeverity(value: unknown): ProviderVulnerability['severity'] {
  const severity = normalizeSeverityEntry(value);
  if (severity !== 'unknown') {
    return severity;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const candidate = normalizeSeverityEntry(entry);
      if (candidate !== 'unknown') {
        return candidate;
      }
    }
  }

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
          severity: normalizeSeverity(vuln['severity']),
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

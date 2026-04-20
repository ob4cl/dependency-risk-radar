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

function roundupToSingleDecimal(value: number): number {
  return Math.ceil((value + Number.EPSILON) * 10) / 10;
}

function parseCvssV3VectorScore(vector: string): number | null {
  const parts = vector.trim().split('/');
  if (parts.length < 2) return null;
  if (!/^CVSS:3\.[01]$/i.test(parts[0] ?? '')) return null;

  const metrics = new Map<string, string>();
  for (const part of parts.slice(1)) {
    const separatorIndex = part.indexOf(':');
    if (separatorIndex <= 0) continue;
    const key = part.slice(0, separatorIndex).trim().toUpperCase();
    const value = part.slice(separatorIndex + 1).trim().toUpperCase();
    if (key && value) metrics.set(key, value);
  }

  const av = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 }[metrics.get('AV') ?? ''];
  const ac = { L: 0.77, H: 0.44 }[metrics.get('AC') ?? ''];
  const scope = metrics.get('S');
  const pr = scope === 'C'
    ? { N: 0.85, L: 0.68, H: 0.5 }[metrics.get('PR') ?? '']
    : { N: 0.85, L: 0.62, H: 0.27 }[metrics.get('PR') ?? ''];
  const ui = { N: 0.85, R: 0.62 }[metrics.get('UI') ?? ''];
  const c = { N: 0, L: 0.22, H: 0.56 }[metrics.get('C') ?? ''];
  const i = { N: 0, L: 0.22, H: 0.56 }[metrics.get('I') ?? ''];
  const a = { N: 0, L: 0.22, H: 0.56 }[metrics.get('A') ?? ''];

  if (
    av === undefined
    || ac === undefined
    || !scope
    || (scope !== 'U' && scope !== 'C')
    || pr === undefined
    || ui === undefined
    || c === undefined
    || i === undefined
    || a === undefined
  ) {
    return null;
  }

  const exploitability = 8.22 * av * ac * pr * ui;
  const iscBase = 1 - ((1 - c) * (1 - i) * (1 - a));
  const impact = scope === 'U'
    ? 6.42 * iscBase
    : 7.52 * (iscBase - 0.029) - 3.25 * Math.pow(iscBase - 0.02, 15);

  if (impact <= 0) return 0;

  const score = scope === 'U'
    ? Math.min(impact + exploitability, 10)
    : Math.min(1.08 * (impact + exploitability), 10);

  return roundupToSingleDecimal(score);
}

function extractNumericScore(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  if (/^(?:10(?:\.0+)?|[0-9](?:\.\d+)?)$/.test(trimmed)) {
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : null;
  }

  const scoreFieldMatch = trimmed.match(/(?:^|\b|\/)(?:base[_\s-]*score|score|bs)\s*[:=]\s*(10(?:\.0+)?|[0-9](?:\.\d+)?)(?:\b|$)/i);
  if (scoreFieldMatch?.[1]) {
    const numeric = Number(scoreFieldMatch[1]);
    return Number.isFinite(numeric) ? numeric : null;
  }

  const cvssValueMatch = trimmed.match(/^CVSS\s*[:=]\s*(10(?:\.0+)?|[0-9](?:\.\d+)?)$/i);
  if (cvssValueMatch?.[1]) {
    const numeric = Number(cvssValueMatch[1]);
    return Number.isFinite(numeric) ? numeric : null;
  }

  return null;
}

function extractCvssScore(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value < 0 || value > 10) return null;
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const directNumericScore = extractNumericScore(value);
  if (directNumericScore !== null) {
    return directNumericScore;
  }

  const trimmed = value.trim();
  if (/^CVSS:3\.[01]\//i.test(trimmed)) {
    return parseCvssV3VectorScore(trimmed);
  }

  if (/^CVSS:4(?:\.0)?\//i.test(trimmed)) {
    return extractNumericScore(trimmed);
  }

  return null;
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
  const parsedScore = extractCvssScore(entry);
  if (parsedScore !== null) {
    return severityFromNumericScore(parsedScore);
  }

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
    const score = extractCvssScore(field);
    if (score !== null) {
      return severityFromNumericScore(score);
    }

    const normalized = normalizeSeverityEntry(field);
    if (normalized !== 'unknown') {
      return normalized;
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

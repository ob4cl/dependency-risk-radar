import type { PackageMetadataProvider, ProviderEcosystem, ProviderPackageMetadata } from './types';
import { fetchJson, normalizeRepositoryUrl } from './utils';
import { MemoryCache } from './cache';

function resolveVersionEntry(registry: Record<string, unknown>, packageName: string, version?: string | null): Record<string, unknown> | null {
  if (version && typeof registry[version] === 'object' && registry[version]) {
    return registry[version] as Record<string, unknown>;
  }
  const distTags = registry['dist-tags'];
  if (distTags && typeof distTags === 'object') {
    const latest = (distTags as Record<string, unknown>)['latest'];
    if (typeof latest === 'string' && typeof registry[latest] === 'object' && registry[latest]) {
      return registry[latest] as Record<string, unknown>;
    }
  }
  return null;
}

export class NpmRegistryMetadataProvider implements PackageMetadataProvider {
  private readonly cache = new MemoryCache<ProviderPackageMetadata | null>();

  constructor(private readonly timeoutMs = 5_000) {}

  async getPackageMetadata(packageName: string, version?: string | null, ecosystem: ProviderEcosystem = 'npm'): Promise<ProviderPackageMetadata | null> {
    const cacheKey = `${ecosystem}:${packageName}:${version ?? 'latest'}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) return cached;

    const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
    const registry = await fetchJson(url, {}, this.timeoutMs);
    if (!registry || typeof registry !== 'object') {
      this.cache.set(cacheKey, null);
      return null;
    }

    const versionEntry = resolveVersionEntry(registry as Record<string, unknown>, packageName, version);
    if (!versionEntry) {
      this.cache.set(cacheKey, null);
      return null;
    }

    const metadata: ProviderPackageMetadata = {
      ecosystem,
      packageName,
      version: typeof versionEntry['version'] === 'string' ? versionEntry['version'] : version ?? null,
      license: typeof versionEntry['license'] === 'string' ? versionEntry['license'] : null,
      repository: normalizeRepositoryUrl(versionEntry['repository']),
      homepage: typeof versionEntry['homepage'] === 'string' ? versionEntry['homepage'] : null,
      description: typeof versionEntry['description'] === 'string' ? versionEntry['description'] : null,
      source: 'npm',
      raw: versionEntry,
    };
    this.cache.set(cacheKey, metadata);
    return metadata;
  }
}

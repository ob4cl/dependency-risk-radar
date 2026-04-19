import type { PackageMetadataProvider, ProviderEcosystem, ProviderPackageMetadata } from './types';
import { parseGitHubSlug } from './utils';
import { MemoryCache } from './cache';

export class GitHubRepositoryMetadataProvider implements PackageMetadataProvider {
  private readonly cache = new MemoryCache<ProviderPackageMetadata | null>();

  constructor(private readonly timeoutMs = 5_000) {}

  async getPackageMetadata(packageName: string, version?: string | null, ecosystem: ProviderEcosystem = 'npm'): Promise<ProviderPackageMetadata | null> {
    const cacheKey = `${ecosystem}:${packageName}:${version ?? 'latest'}:github`;
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) return cached;

    const slug = parseGitHubSlug(packageName);
    if (!slug) {
      this.cache.set(cacheKey, null);
      return null;
    }

    const response = await fetch(`https://api.github.com/repos/${slug.owner}/${slug.repo}`, {
      headers: {
        accept: 'application/vnd.github+json',
        'user-agent': 'dradar',
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    }).catch(() => null);

    if (!response || !response.ok) {
      this.cache.set(cacheKey, null);
      return null;
    }

    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!data) {
      this.cache.set(cacheKey, null);
      return null;
    }

    const metadata: ProviderPackageMetadata = {
      ecosystem,
      packageName,
      version: version ?? null,
      license: typeof data['license'] === 'object' && data['license'] && typeof (data['license'] as Record<string, unknown>)['spdx_id'] === 'string'
        ? (data['license'] as Record<string, unknown>)['spdx_id'] as string
        : null,
      repository: typeof data['html_url'] === 'string' ? data['html_url'] : null,
      homepage: typeof data['homepage'] === 'string' ? data['homepage'] : null,
      description: typeof data['description'] === 'string' ? data['description'] : null,
      source: 'github',
    };
    this.cache.set(cacheKey, metadata);
    return metadata;
  }
}

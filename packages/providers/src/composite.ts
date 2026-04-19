import type { PackageMetadataProvider, ProviderBundle, ProviderEcosystem, ProviderPackageMetadata, ProviderVulnerability, VulnerabilityProvider } from './types';
import { NpmRegistryMetadataProvider } from './npm-registry-provider';
import { OsvVulnerabilityProvider } from './osv-provider';

export class CompositePackageMetadataProvider implements PackageMetadataProvider {
  constructor(private readonly providers: PackageMetadataProvider[]) {}

  async getPackageMetadata(packageName: string, version?: string | null, ecosystem: ProviderEcosystem = 'npm'): Promise<ProviderPackageMetadata | null> {
    for (const provider of this.providers) {
      const metadata = await provider.getPackageMetadata(packageName, version, ecosystem);
      if (metadata) return metadata;
    }
    return null;
  }
}

export class CompositeVulnerabilityProvider implements VulnerabilityProvider {
  constructor(private readonly providers: VulnerabilityProvider[]) {}

  async getVulnerabilities(packageName: string, version?: string | null, ecosystem: ProviderEcosystem = 'npm'): Promise<ProviderVulnerability[]> {
    const results = await Promise.all(
      this.providers.map(async (provider) => provider.getVulnerabilities(packageName, version, ecosystem)),
    );
    return results.flat().sort((left, right) => left.id.localeCompare(right.id));
  }
}

export function createOfflineProviderBundle(): ProviderBundle {
  return {
    metadata: {
      async getPackageMetadata() {
        return null;
      },
    },
    vulnerabilities: {
      async getVulnerabilities() {
        return [];
      },
    },
  };
}

export function createLiveProviderBundle(): ProviderBundle {
  return {
    metadata: new CompositePackageMetadataProvider([
      new NpmRegistryMetadataProvider(),
    ]),
    vulnerabilities: new CompositeVulnerabilityProvider([
      new OsvVulnerabilityProvider(),
    ]),
  };
}

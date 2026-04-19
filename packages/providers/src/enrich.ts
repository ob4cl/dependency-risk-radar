import type { NormalizedDependencyChange, PackageMetadata } from '@drr/shared';
import type { ProviderBundle } from './types';

export async function enrichDependencyChanges(
  changes: NormalizedDependencyChange[],
  providers: ProviderBundle,
): Promise<NormalizedDependencyChange[]> {
  const enriched = await Promise.all(
    changes.map(async (change) => {
      const [metadata, vulnerabilities] = await Promise.all([
        providers.metadata.getPackageMetadata(change.name, change.toVersion ?? change.fromVersion, change.ecosystem),
        providers.vulnerabilities.getVulnerabilities(change.name, change.toVersion ?? change.fromVersion, change.ecosystem),
      ]);

      if (!metadata && vulnerabilities.length === 0) {
        return change;
      }

      const extra: Record<string, unknown> = {
        metadataSource: metadata?.source ?? null,
        vulnerabilityCount: vulnerabilities.length,
      };

      if (metadata?.raw && typeof metadata.raw === 'object') {
        extra['providerMetadataRaw'] = metadata.raw;
      }

      if (metadata) {
        extra['registry'] = {
          ecosystem: metadata.ecosystem,
          packageName: metadata.packageName,
          version: metadata.version,
          license: metadata.license,
          repository: metadata.repository,
          homepage: metadata.homepage,
          description: metadata.description,
        };
      }

      if (vulnerabilities.length > 0) {
        extra['vulnerabilities'] = vulnerabilities;
      }

      const mergedMetadata: PackageMetadata = {
        ...change.metadata,
        extra: {
          ...(change.metadata.extra ?? {}),
          ...extra,
        },
      };

      if (metadata?.license !== null && metadata?.license !== undefined) {
        mergedMetadata.license = metadata.license;
      }
      if (metadata?.repository !== null && metadata?.repository !== undefined) {
        mergedMetadata.repository = metadata.repository;
      }
      if (metadata?.homepage !== null && metadata?.homepage !== undefined) {
        mergedMetadata.homepage = metadata.homepage;
      }
      if (metadata?.description !== null && metadata?.description !== undefined) {
        mergedMetadata.description = metadata.description;
      }

      return {
        ...change,
        metadata: mergedMetadata,
      };
    }),
  );

  return enriched;
}

import type { NormalizedDependencyChange } from '@drr/shared';
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
        provider: {
          metadataSource: metadata?.source ?? null,
          vulnerabilityCount: vulnerabilities.length,
        },
      };

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

      return {
        ...change,
        metadata: {
          ...change.metadata,
          extra: {
            ...(change.metadata.extra ?? {}),
            ...extra,
          },
        },
      };
    }),
  );

  return enriched;
}

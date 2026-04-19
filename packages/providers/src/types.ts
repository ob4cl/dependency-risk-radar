export type ProviderEcosystem = 'npm' | 'pnpm';

export interface ProviderPackageMetadata {
  ecosystem: ProviderEcosystem;
  packageName: string;
  version: string | null;
  license: string | null;
  repository: string | null;
  homepage: string | null;
  description: string | null;
  source: 'npm' | 'github';
}

export type ProviderSeverity = 'critical' | 'high' | 'moderate' | 'low' | 'unknown';

export interface ProviderVulnerability {
  id: string;
  summary: string;
  details: string | null;
  severity: ProviderSeverity;
  aliases: string[];
  references: string[];
  packageName: string;
  version: string | null;
  ecosystem: ProviderEcosystem;
}

export interface PackageMetadataProvider {
  getPackageMetadata(
    packageName: string,
    version?: string | null,
    ecosystem?: ProviderEcosystem,
  ): Promise<ProviderPackageMetadata | null>;
}

export interface VulnerabilityProvider {
  getVulnerabilities(
    packageName: string,
    version?: string | null,
    ecosystem?: ProviderEcosystem,
  ): Promise<ProviderVulnerability[]>;
}

export interface ProviderBundle {
  metadata: PackageMetadataProvider;
  vulnerabilities: VulnerabilityProvider;
}

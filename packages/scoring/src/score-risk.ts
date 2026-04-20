import type { AnalysisSummary, Decision, NormalizedDependencyChange, RiskFinding } from '@drr/shared';

export interface ScoringPolicy {
  thresholds: {
    warnScore: number;
    failScore: number;
    highRiskScore?: number;
  };
  weights: {
    vulnerability: number;
    installTimeExecution: number;
    blastRadius: number;
    maintenanceTrust: number;
    policy: number;
  };
  deniedPackages: string[];
  deniedLicenses: string[];
  requireInstallScriptReview: boolean;
  blockKnownCriticalVulns: boolean;
}

const WARN_SCORE = 25;
const HIGH_RISK_SCORE = 50;
const FAIL_SCORE = 70;

function normalizePolicyList(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))).sort((left, right) => left.localeCompare(right));
}

function getMetadataExtra(change: NormalizedDependencyChange): Record<string, unknown> | undefined {
  return change.metadata.extra;
}

function getMetadataSource(extra: Record<string, unknown> | undefined): string | null {
  const value = extra?.['metadataSource'];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function getString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function getVulnerabilityEntries(extra: Record<string, unknown> | undefined): Array<Record<string, unknown>> {
  const value = extra?.['vulnerabilities'];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item));
}

function severityFromVulnerabilities(vulnerabilities: Array<Record<string, unknown>>): RiskFinding['severity'] {
  const severities = vulnerabilities
    .map((entry) => entry['severity'])
    .filter(getString)
    .map((value) => value.toLowerCase());

  if (severities.includes('critical')) return 'critical';
  if (severities.includes('high')) return 'high';
  if (severities.includes('moderate')) return 'medium';
  if (severities.includes('low')) return 'low';
  return vulnerabilities.length > 0 ? 'medium' : 'info';
}

function hasCriticalVulnerability(vulnerabilities: Array<Record<string, unknown>>): boolean {
  return vulnerabilities.some((entry) => {
    const severity = entry['severity'];
    return typeof severity === 'string' && severity.trim().toLowerCase() === 'critical';
  });
}

function decisionFromScore(score: number, policy: ScoringPolicy): Decision {
  if (score >= policy.thresholds.failScore) return 'fail';
  if (score >= (policy.thresholds.highRiskScore ?? HIGH_RISK_SCORE)) return 'high-risk';
  if (score >= policy.thresholds.warnScore) return 'warn';
  return 'pass';
}

function addFinding(findings: RiskFinding[], finding: RiskFinding): void {
  findings.push(finding);
}

function createEvidenceList(pairs: Array<[string, unknown]>): string[] {
  return pairs
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${String(value)}`);
}

export interface ScoreResult {
  findings: RiskFinding[];
  summary: AnalysisSummary;
}

export const defaultScoringPolicy: ScoringPolicy = {
  thresholds: {
    warnScore: WARN_SCORE,
    failScore: FAIL_SCORE,
    highRiskScore: HIGH_RISK_SCORE,
  },
  weights: {
    vulnerability: 40,
    installTimeExecution: 20,
    blastRadius: 15,
    maintenanceTrust: 15,
    policy: 10,
  },
  deniedPackages: [],
  deniedLicenses: [],
  requireInstallScriptReview: true,
  blockKnownCriticalVulns: true,
};

export function scoreDependencyChanges(changes: NormalizedDependencyChange[], policy = defaultScoringPolicy): ScoreResult {
  const normalizedPolicy: ScoringPolicy = {
    ...policy,
    thresholds: {
      ...policy.thresholds,
      highRiskScore: policy.thresholds.highRiskScore ?? HIGH_RISK_SCORE,
    },
    deniedPackages: normalizePolicyList(policy.deniedPackages),
    deniedLicenses: normalizePolicyList(policy.deniedLicenses),
  };
  const findings: RiskFinding[] = [];
  let totalScore = 0;
  let hasBlockingCriticalVulnerability = false;

  for (const change of changes) {
    const extra = getMetadataExtra(change);
    const metadataSource = getMetadataSource(extra);
    const installScript = Boolean(
      change.metadata.hasInstallScript
      || change.metadata.hasPreinstallScript
      || change.metadata.hasPostinstallScript
      || change.metadata.hasPrepareScript,
    );
    const vulnerabilityEntries = getVulnerabilityEntries(extra);
    const criticalVulnerability = hasCriticalVulnerability(vulnerabilityEntries);
    const hasBlastRadius = typeof change.transitiveCountDelta === 'number' && Math.abs(change.transitiveCountDelta) >= 10;
    const blockedPackage = normalizedPolicy.deniedPackages.includes(change.name.trim());
    const packageLicense = change.metadata.license?.trim() ?? null;
    const blockedLicense = Boolean(packageLicense && normalizedPolicy.deniedLicenses.includes(packageLicense));
    const repository = change.metadata.repository?.trim() ?? null;
    const homepage = change.metadata.homepage?.trim() ?? null;
    const description = change.metadata.description?.trim() ?? null;

    if (vulnerabilityEntries.length > 0) {
      addFinding(findings, {
        id: `vulnerability:${change.name}`,
        category: 'known-vulnerability',
        severity: severityFromVulnerabilities(vulnerabilityEntries),
        score: normalizedPolicy.weights.vulnerability,
        title: `Known vulnerability for ${change.name}`,
        summary: `${change.name} has ${vulnerabilityEntries.length} known ${vulnerabilityEntries.length === 1 ? 'vulnerability' : 'vulnerabilities'}.`,
        evidence: [
          `vulnerabilityCount=${vulnerabilityEntries.length}`,
          ...vulnerabilityEntries.slice(0, 5).flatMap((entry) => createEvidenceList([
            ['id', entry['id']],
            ['severity', entry['severity']],
            ['summary', entry['summary']],
          ])),
        ],
        recommendation: 'Review the vulnerability details and upgrade or replace the package.',
        package: change.name,
        version: change.toVersion,
        direct: change.direct,
      });
      totalScore += normalizedPolicy.weights.vulnerability;
      if (criticalVulnerability && normalizedPolicy.blockKnownCriticalVulns) {
        hasBlockingCriticalVulnerability = true;
      }
    }

    if (installScript && normalizedPolicy.requireInstallScriptReview) {
      addFinding(findings, {
        id: `install-script:${change.name}`,
        category: 'install-time-execution',
        severity: 'high',
        score: normalizedPolicy.weights.installTimeExecution,
        title: `Install-time execution risk for ${change.name}`,
        summary: `${change.name} can run install-time hooks.`,
        evidence: [
          `installScript=${change.metadata.hasInstallScript ? 'yes' : 'no'}`,
          `preinstall=${change.metadata.hasPreinstallScript ? 'yes' : 'no'}`,
          `postinstall=${change.metadata.hasPostinstallScript ? 'yes' : 'no'}`,
          `prepare=${change.metadata.hasPrepareScript ? 'yes' : 'no'}`,
        ],
        recommendation: 'Review the package lifecycle hooks before merging.',
        package: change.name,
        version: change.toVersion,
        direct: change.direct,
      });
      totalScore += normalizedPolicy.weights.installTimeExecution;
    }

    if (hasBlastRadius) {
      addFinding(findings, {
        id: `blast-radius:${change.name}`,
        category: 'blast-radius',
        severity: 'medium',
        score: normalizedPolicy.weights.blastRadius,
        title: `Transitive blast radius changed for ${change.name}`,
        summary: `${change.name} changes the dependency graph by ${change.transitiveCountDelta} packages.`,
        evidence: [`transitiveCountDelta=${change.transitiveCountDelta}`],
        recommendation: 'Inspect the expanded dependency graph for unexpected churn.',
        package: change.name,
        version: change.toVersion,
        direct: change.direct,
      });
      totalScore += normalizedPolicy.weights.blastRadius;
    }

    if (!repository && !homepage && !description) {
      addFinding(findings, {
        id: `maintenance:${change.name}`,
        category: 'maintenance-trust',
        severity: 'medium',
        score: normalizedPolicy.weights.maintenanceTrust,
        title: `Low maintenance confidence for ${change.name}`,
        summary: `${change.name} is missing repository, homepage, and description metadata.`,
        evidence: createEvidenceList([
          ['repository', repository ?? 'missing'],
          ['homepage', homepage ?? 'missing'],
          ['description', description ?? 'missing'],
          ['metadataSource', metadataSource ?? 'unknown'],
        ]),
        recommendation: 'Verify the package ownership and maintenance signals before merging.',
        package: change.name,
        version: change.toVersion,
        direct: change.direct,
      });
      totalScore += normalizedPolicy.weights.maintenanceTrust;
    }

    if (blockedPackage) {
      addFinding(findings, {
        id: `policy-package:${change.name}`,
        category: 'policy',
        severity: 'high',
        score: normalizedPolicy.weights.policy,
        title: `Denied package: ${change.name}`,
        summary: `${change.name} is blocked by local policy.`,
        evidence: [`package=${change.name}`],
        recommendation: 'Remove or replace the denied package.',
        package: change.name,
        version: change.toVersion,
        direct: change.direct,
        policySource: 'packages.deny',
      });
      totalScore += normalizedPolicy.weights.policy;
    }

    if (blockedLicense) {
      addFinding(findings, {
        id: `policy-license:${change.name}`,
        category: 'policy',
        severity: 'high',
        score: normalizedPolicy.weights.policy,
        title: `Denied license for ${change.name}`,
        summary: `${change.name} uses a denied license (${packageLicense}).`,
        evidence: [`license=${packageLicense}`],
        recommendation: 'Do not merge dependencies with denied licenses.',
        package: change.name,
        version: change.toVersion,
        direct: change.direct,
        policySource: 'licenses.deny',
      });
      totalScore += normalizedPolicy.weights.policy;
    }
  }

  const counts = findings.reduce(
    (acc, finding) => {
      acc[finding.severity] += 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0, info: 0 } as Record<RiskFinding['severity'], number>,
  );

  const summary: AnalysisSummary = {
    totalPackagesReviewed: changes.length,
    changedDirectDependencies: changes.filter((change) => change.direct).length,
    changedTransitiveDependencies: changes.filter((change) => typeof change.transitiveCountDelta === 'number' && change.transitiveCountDelta !== 0).length,
    criticalFindings: counts.critical,
    highFindings: counts.high,
    mediumFindings: counts.medium,
    lowFindings: counts.low,
    totalRiskScore: Math.min(100, totalScore),
    decision: hasBlockingCriticalVulnerability ? 'fail' : decisionFromScore(totalScore, normalizedPolicy),
  };

  return { findings, summary };
}

import type { AnalysisSummary, NormalizedDependencyChange, RiskFinding, Decision } from '@drr/shared';

export interface ScoringPolicy {
  thresholds: {
    warnScore: number;
    failScore: number;
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
}

export const defaultScoringPolicy: ScoringPolicy = {
  thresholds: {
    warnScore: 25,
    failScore: 70,
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
};

function severityFromScore(score: number): RiskFinding['severity'] {
  if (score >= 70) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  if (score > 0) return 'low';
  return 'info';
}

function decisionFromScore(score: number, policy: ScoringPolicy): Decision {
  if (score >= policy.thresholds.failScore) return 'fail';
  if (score >= 50) return 'high-risk';
  if (score >= policy.thresholds.warnScore) return 'warn';
  return 'pass';
}

function addFinding(findings: RiskFinding[], finding: RiskFinding): void {
  findings.push(finding);
}

export interface ScoreResult {
  findings: RiskFinding[];
  summary: AnalysisSummary;
}

export function scoreDependencyChanges(changes: NormalizedDependencyChange[], policy = defaultScoringPolicy): ScoreResult {
  const findings: RiskFinding[] = [];
  let totalScore = 0;

  for (const change of changes) {
    const installScript = Boolean(change.metadata.hasInstallScript || change.metadata.hasPreinstallScript || change.metadata.hasPostinstallScript || change.metadata.hasPrepareScript);
    const blastRadius = typeof change.transitiveCountDelta === 'number' && Math.abs(change.transitiveCountDelta) >= 10;
    const blockedPackage = policy.deniedPackages.includes(change.name);
    const blockedLicense = Boolean(change.metadata.license && policy.deniedLicenses.includes(change.metadata.license));

    if (installScript && policy.requireInstallScriptReview) {
      addFinding(findings, {
        id: `install-script:${change.name}`,
        category: 'install-time-execution',
        severity: 'high',
        score: policy.weights.installTimeExecution,
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
      totalScore += policy.weights.installTimeExecution;
    }

    if (blastRadius) {
      addFinding(findings, {
        id: `blast-radius:${change.name}`,
        category: 'blast-radius',
        severity: 'medium',
        score: policy.weights.blastRadius,
        title: `Transitive blast radius changed for ${change.name}`,
        summary: `${change.name} changes the dependency graph by ${change.transitiveCountDelta} packages.`,
        evidence: [`transitiveCountDelta=${change.transitiveCountDelta}`],
        recommendation: 'Inspect the expanded dependency graph for unexpected churn.',
        package: change.name,
        version: change.toVersion,
        direct: change.direct,
      });
      totalScore += policy.weights.blastRadius;
    }

    if (blockedPackage) {
      addFinding(findings, {
        id: `policy-package:${change.name}`,
        category: 'policy',
        severity: 'high',
        score: policy.weights.policy,
        title: `Denied package: ${change.name}`,
        summary: `${change.name} is blocked by local policy.`,
        evidence: [`package=${change.name}`],
        recommendation: 'Remove or replace the denied package.',
        package: change.name,
        version: change.toVersion,
        direct: change.direct,
        policySource: 'packages.deny',
      });
      totalScore += policy.weights.policy;
    }

    if (blockedLicense) {
      addFinding(findings, {
        id: `policy-license:${change.name}`,
        category: 'policy',
        severity: 'high',
        score: policy.weights.policy,
        title: `Denied license for ${change.name}`,
        summary: `${change.name} uses a denied license (${change.metadata.license}).`,
        evidence: [`license=${change.metadata.license}`],
        recommendation: 'Do not merge dependencies with denied licenses.',
        package: change.name,
        version: change.toVersion,
        direct: change.direct,
        policySource: 'licenses.deny',
      });
      totalScore += policy.weights.policy;
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
    decision: decisionFromScore(totalScore, policy),
  };

  return { findings, summary };
}

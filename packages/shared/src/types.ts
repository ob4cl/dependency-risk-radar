export type Ecosystem = 'npm' | 'pnpm';

export type DependencyChangeType =
  | 'added'
  | 'removed'
  | 'upgraded'
  | 'downgraded'
  | 'lockfile-only'
  | 'unchanged';

export type FindingCategory =
  | 'known-vulnerability'
  | 'install-time-execution'
  | 'blast-radius'
  | 'maintenance-trust'
  | 'policy';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type Decision = 'pass' | 'warn' | 'high-risk' | 'fail';

export interface PackageMetadata {
  hasInstallScript?: boolean;
  hasPreinstallScript?: boolean;
  hasPostinstallScript?: boolean;
  hasPrepareScript?: boolean;
  nativeBuild?: boolean;
  repository?: string | null;
  license?: string | null;
  homepage?: string | null;
  description?: string | null;
  extra?: Record<string, unknown>;
}

export interface NormalizedDependencyChange {
  ecosystem: Ecosystem;
  name: string;
  changeType: DependencyChangeType;
  fromVersion: string | null;
  toVersion: string | null;
  direct: boolean;
  manifestPath: string;
  lockfilePath: string | null;
  workspace: string | null;
  transitiveCountDelta?: number;
  metadata: PackageMetadata;
}

export interface RiskFinding {
  id: string;
  category: FindingCategory;
  severity: Severity;
  score: number;
  title: string;
  summary: string;
  evidence: string[];
  recommendation: string;
  package: string | null;
  version: string | null;
  direct: boolean;
  policySource?: string;
}

export interface AnalysisSummary {
  totalPackagesReviewed: number;
  changedDirectDependencies: number;
  changedTransitiveDependencies: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  totalRiskScore: number;
  decision: Decision;
}

export interface FinalAnalysisResult {
  analysisVersion: string;
  repoPath: string;
  baseRef: string;
  headRef: string;
  generatedAt: string;
  summary: AnalysisSummary;
  dependencyChanges: NormalizedDependencyChange[];
  findings: RiskFinding[];
  markdownReport: string;
  policyApplied: boolean;
  exitCodeRecommendation: number;
}

export interface AnalysisInput {
  repoPath: string;
  baseRef: string;
  headRef: string;
  policyPath?: string | null;
  liveMetadata?: boolean;
  allowedWorkspaceRoot?: string | null;
  allowedConfigRoot?: string | null;
}

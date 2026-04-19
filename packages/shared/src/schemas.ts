import { z } from 'zod';

export const ecosystemSchema = z.enum(['npm', 'pnpm']);
export const dependencyChangeTypeSchema = z.enum([
  'added',
  'removed',
  'upgraded',
  'downgraded',
  'lockfile-only',
  'unchanged',
]);
export const severitySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);
export const decisionSchema = z.enum(['pass', 'warn', 'high-risk', 'fail']);

export const packageMetadataSchema = z.object({
  hasInstallScript: z.boolean().optional(),
  hasPreinstallScript: z.boolean().optional(),
  hasPostinstallScript: z.boolean().optional(),
  hasPrepareScript: z.boolean().optional(),
  nativeBuild: z.boolean().optional(),
  repository: z.string().nullable().optional(),
  license: z.string().nullable().optional(),
  homepage: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  extra: z.record(z.string(), z.unknown()).optional(),
});

export const normalizedDependencyChangeSchema = z.object({
  ecosystem: ecosystemSchema,
  name: z.string().min(1),
  changeType: dependencyChangeTypeSchema,
  fromVersion: z.string().nullable(),
  toVersion: z.string().nullable(),
  direct: z.boolean(),
  manifestPath: z.string().min(1),
  lockfilePath: z.string().nullable(),
  workspace: z.string().nullable(),
  transitiveCountDelta: z.number().int().optional(),
  metadata: packageMetadataSchema,
});

export const riskFindingSchema = z.object({
  id: z.string().min(1),
  category: z.enum([
    'known-vulnerability',
    'install-time-execution',
    'blast-radius',
    'maintenance-trust',
    'policy',
  ]),
  severity: severitySchema,
  score: z.number().int().nonnegative(),
  title: z.string().min(1),
  summary: z.string().min(1),
  evidence: z.array(z.string().min(1)),
  recommendation: z.string().min(1),
  package: z.string().nullable(),
  version: z.string().nullable(),
  direct: z.boolean(),
  policySource: z.string().optional(),
});

export const analysisSummarySchema = z.object({
  totalPackagesReviewed: z.number().int().nonnegative(),
  changedDirectDependencies: z.number().int().nonnegative(),
  changedTransitiveDependencies: z.number().int().nonnegative(),
  criticalFindings: z.number().int().nonnegative(),
  highFindings: z.number().int().nonnegative(),
  mediumFindings: z.number().int().nonnegative(),
  lowFindings: z.number().int().nonnegative(),
  totalRiskScore: z.number().int().nonnegative(),
  decision: decisionSchema,
});

export const finalAnalysisResultSchema = z.object({
  analysisVersion: z.string().min(1),
  repoPath: z.string().min(1),
  baseRef: z.string().min(1),
  headRef: z.string().min(1),
  generatedAt: z.string().datetime(),
  summary: analysisSummarySchema,
  dependencyChanges: z.array(normalizedDependencyChangeSchema),
  findings: z.array(riskFindingSchema),
  markdownReport: z.string(),
  policyApplied: z.boolean(),
  exitCodeRecommendation: z.number().int(),
});

export const analysisInputSchema = z.object({
  repoPath: z.string().min(1),
  baseRef: z.string().min(1),
  headRef: z.string().min(1),
  policyPath: z.string().nullable().optional(),
  liveMetadata: z.boolean().optional(),
});

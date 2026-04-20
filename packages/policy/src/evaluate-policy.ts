import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { PolicyValidationError } from '@drr/shared';

const defaultScoringWeights = {
  vulnerability: 40,
  install_time_execution: 20,
  blast_radius: 15,
  maintenance_trust: 15,
  policy: 10,
} as const;

const defaultScoringConfig = {
  high_risk_score: 50,
  weights: defaultScoringWeights,
} as const;

const policySchema = z.object({
  ecosystems: z.object({
    npm: z.object({ enabled: z.boolean().default(true) }).default({ enabled: true }),
    pnpm: z.object({ enabled: z.boolean().default(true) }).default({ enabled: true }),
  }).default({ npm: { enabled: true }, pnpm: { enabled: true } }),
  thresholds: z.object({
    block_score: z.number().int().min(0).default(70),
    warn_score: z.number().int().min(0).default(25),
  }).default({ block_score: 70, warn_score: 25 }),
  scoring: z.object({
    high_risk_score: z.number().int().min(0).default(defaultScoringConfig.high_risk_score),
    weights: z.object({
      vulnerability: z.number().int().min(0).default(defaultScoringWeights.vulnerability),
      install_time_execution: z.number().int().min(0).default(defaultScoringWeights.install_time_execution),
      blast_radius: z.number().int().min(0).default(defaultScoringWeights.blast_radius),
      maintenance_trust: z.number().int().min(0).default(defaultScoringWeights.maintenance_trust),
      policy: z.number().int().min(0).default(defaultScoringWeights.policy),
    }).default(defaultScoringWeights),
  }).default(defaultScoringConfig),
  policies: z.object({
    block_known_critical_vulns: z.boolean().default(true),
    require_lockfile: z.boolean().default(true),
    require_manual_review_for_install_scripts: z.boolean().default(true),
  }).default({
    block_known_critical_vulns: true,
    require_lockfile: true,
    require_manual_review_for_install_scripts: true,
  }),
  licenses: z.object({ deny: z.array(z.string()).default([]) }).default({ deny: [] }),
  packages: z.object({ deny: z.array(z.string()).default([]) }).default({ deny: [] }),
});

export interface PolicyConfig {
  ecosystems: {
    npm: { enabled: boolean };
    pnpm: { enabled: boolean };
  };
  thresholds: {
    block_score: number;
    warn_score: number;
  };
  scoring: {
    high_risk_score: number;
    weights: {
      vulnerability: number;
      install_time_execution: number;
      blast_radius: number;
      maintenance_trust: number;
      policy: number;
    };
  };
  policies: {
    block_known_critical_vulns: boolean;
    require_lockfile: boolean;
    require_manual_review_for_install_scripts: boolean;
  };
  licenses: { deny: string[] };
  packages: { deny: string[] };
}

export interface ScoringConfig {
  thresholds: {
    warnScore: number;
    failScore: number;
    highRiskScore: number;
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

export const defaultPolicyConfig: PolicyConfig = {
  ecosystems: {
    npm: { enabled: true },
    pnpm: { enabled: true },
  },
  thresholds: {
    block_score: 70,
    warn_score: 25,
  },
  scoring: {
    high_risk_score: defaultScoringConfig.high_risk_score,
    weights: {
      vulnerability: defaultScoringWeights.vulnerability,
      install_time_execution: defaultScoringWeights.install_time_execution,
      blast_radius: defaultScoringWeights.blast_radius,
      maintenance_trust: defaultScoringWeights.maintenance_trust,
      policy: defaultScoringWeights.policy,
    },
  },
  policies: {
    block_known_critical_vulns: true,
    require_lockfile: true,
    require_manual_review_for_install_scripts: true,
  },
  licenses: { deny: [] },
  packages: { deny: [] },
};

function normalizeEntries(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))).sort((left, right) => left.localeCompare(right));
}

export function parsePolicyYaml(text: string): PolicyConfig {
  let raw: unknown;
  try {
    raw = parseYaml(text);
  } catch (error) {
    throw new PolicyValidationError('Invalid policy YAML', { error: error instanceof Error ? error.message : String(error) });
  }
  const parsed = policySchema.safeParse(raw ?? {});
  if (!parsed.success) {
    throw new PolicyValidationError('Invalid policy configuration', { issues: parsed.error.issues });
  }
  return {
    ...parsed.data,
    packages: { deny: normalizeEntries(parsed.data.packages.deny) },
    licenses: { deny: normalizeEntries(parsed.data.licenses.deny) },
  } as PolicyConfig;
}

export function policyToScoringConfig(policy: PolicyConfig): ScoringConfig {
  return {
    thresholds: {
      warnScore: policy.thresholds.warn_score,
      failScore: policy.thresholds.block_score,
      highRiskScore: policy.scoring.high_risk_score,
    },
    weights: {
      vulnerability: policy.scoring.weights.vulnerability,
      installTimeExecution: policy.scoring.weights.install_time_execution,
      blastRadius: policy.scoring.weights.blast_radius,
      maintenanceTrust: policy.scoring.weights.maintenance_trust,
      policy: policy.scoring.weights.policy,
    },
    deniedPackages: [...policy.packages.deny],
    deniedLicenses: [...policy.licenses.deny],
    requireInstallScriptReview: policy.policies.require_manual_review_for_install_scripts,
    blockKnownCriticalVulns: policy.policies.block_known_critical_vulns,
  };
}

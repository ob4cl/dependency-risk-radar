import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { PolicyValidationError } from '@drr/shared';

const policySchema = z.object({
  ecosystems: z.object({
    npm: z.object({ enabled: z.boolean().default(true) }).default({ enabled: true }),
    pnpm: z.object({ enabled: z.boolean().default(true) }).default({ enabled: true }),
  }).default({ npm: { enabled: true }, pnpm: { enabled: true } }),
  thresholds: z.object({
    block_score: z.number().int().default(70),
    warn_score: z.number().int().default(40),
  }).default({ block_score: 70, warn_score: 40 }),
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
  policies: {
    block_known_critical_vulns: boolean;
    require_lockfile: boolean;
    require_manual_review_for_install_scripts: boolean;
  };
  licenses: { deny: string[] };
  packages: { deny: string[] };
}

export const defaultPolicyConfig: PolicyConfig = {
  ecosystems: {
    npm: { enabled: true },
    pnpm: { enabled: true },
  },
  thresholds: {
    block_score: 70,
    warn_score: 40,
  },
  policies: {
    block_known_critical_vulns: true,
    require_lockfile: true,
    require_manual_review_for_install_scripts: true,
  },
  licenses: { deny: [] },
  packages: { deny: [] },
};

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
  return parsed.data as PolicyConfig;
}

export function policyToScoringConfig(policy: PolicyConfig) {
  return {
    thresholds: {
      warnScore: 25,
      failScore: policy.thresholds.block_score,
    },
    weights: {
      vulnerability: 40,
      installTimeExecution: 20,
      blastRadius: 15,
      maintenanceTrust: 15,
      policy: 10,
    },
    deniedPackages: policy.packages.deny,
    deniedLicenses: policy.licenses.deny,
    requireInstallScriptReview: policy.policies.require_manual_review_for_install_scripts,
  };
}

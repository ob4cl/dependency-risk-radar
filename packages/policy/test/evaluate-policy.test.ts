import { describe, expect, it } from 'vitest';
import { parsePolicyYaml, policyToScoringConfig } from '@drr/policy';

describe('parsePolicyYaml', () => {
  it('keeps existing defaults when scoring config is omitted', () => {
    const parsed = parsePolicyYaml(`thresholds:\n  warn_score: 40\n`);
    const scoring = policyToScoringConfig(parsed);

    expect(scoring.thresholds.warnScore).toBe(40);
    expect(scoring.thresholds.failScore).toBe(70);
    expect(scoring.thresholds.highRiskScore).toBe(50);
    expect(scoring.weights).toEqual({
      vulnerability: 40,
      installTimeExecution: 20,
      blastRadius: 15,
      maintenanceTrust: 15,
      policy: 10,
    });
  });

  it('passes custom scoring weights and high-risk threshold through policyToScoringConfig', () => {
    const parsed = parsePolicyYaml(`
scoring:
  high_risk_score: 60
  weights:
    vulnerability: 11
    install_time_execution: 22
    blast_radius: 33
    maintenance_trust: 44
    policy: 55
licenses:
  deny:
    - GPL-3.0
packages:
  deny:
    - bad-package
policies:
  block_known_critical_vulns: false
`);
    const scoring = policyToScoringConfig(parsed);

    expect(parsed.packages.deny).toContain('bad-package');
    expect(scoring.deniedLicenses).toContain('GPL-3.0');
    expect(scoring.thresholds.highRiskScore).toBe(60);
    expect(scoring.weights).toEqual({
      vulnerability: 11,
      installTimeExecution: 22,
      blastRadius: 33,
      maintenanceTrust: 44,
      policy: 55,
    });
    expect(scoring.blockKnownCriticalVulns).toBe(false);
  });
});

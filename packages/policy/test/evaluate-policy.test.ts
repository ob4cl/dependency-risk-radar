import { describe, expect, it } from 'vitest';
import { parsePolicyYaml, policyToScoringConfig } from '@drr/policy';

const policy = `ecosystems:
  npm:
    enabled: true
thresholds:
  block_score: 70
  warn_score: 40
policies:
  block_known_critical_vulns: false
  require_manual_review_for_install_scripts: true
licenses:
  deny:
    - GPL-3.0
packages:
  deny:
    - bad-package
`;

describe('parsePolicyYaml', () => {
  it('normalizes policy config', () => {
    const parsed = parsePolicyYaml(policy);
    const scoring = policyToScoringConfig(parsed);
    expect(parsed.packages.deny).toContain('bad-package');
    expect(scoring.deniedLicenses).toContain('GPL-3.0');
    expect(scoring.thresholds.warnScore).toBe(40);
    expect(scoring.blockKnownCriticalVulns).toBe(false);
  });
});

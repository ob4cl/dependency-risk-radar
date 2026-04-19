import { describe, expect, it } from 'vitest';
import { parsePolicyYaml, policyToScoringConfig } from '@drr/policy';

const policy = `ecosystems:
  npm:
    enabled: true
thresholds:
  block_score: 70
  warn_score: 40
policies:
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
    expect(parsed.packages.deny).toContain('bad-package');
    expect(policyToScoringConfig(parsed).deniedLicenses).toContain('GPL-3.0');
    expect(policyToScoringConfig(parsed).thresholds.warnScore).toBe(25);
  });
});

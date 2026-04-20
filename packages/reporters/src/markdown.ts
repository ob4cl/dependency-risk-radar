import type { FinalAnalysisResult } from '@drr/shared';

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F-\u009F]/g;

function sanitizeForDisplay(value: string): string {
  return value.replaceAll(CONTROL_CHARACTER_PATTERN, (character) => {
    const codePoint = character.codePointAt(0);
    if (typeof codePoint !== 'number') {
      return '';
    }
    return `\\u${codePoint.toString(16).padStart(4, '0')}`;
  });
}

export function renderMarkdownReport(result: FinalAnalysisResult): string {
  const lines: string[] = [];
  lines.push('# Dependency Risk Radar');
  lines.push('');
  lines.push(`Decision: **${result.summary.decision}**`);
  lines.push(`Risk score: **${result.summary.totalRiskScore}**`);
  lines.push('');
  lines.push('## Summary');
  lines.push(`- Direct dependency changes: ${result.summary.changedDirectDependencies}`);
  lines.push(`- Transitive dependency changes: ${result.summary.changedTransitiveDependencies}`);
  lines.push(`- Findings: ${result.findings.length}`);
  lines.push('');
  lines.push('## Dependency changes');
  if (result.dependencyChanges.length === 0) {
    lines.push('- None');
  } else {
    for (const change of result.dependencyChanges) {
      const delta = typeof change.transitiveCountDelta === 'number' ? `, transitive Δ ${change.transitiveCountDelta}` : '';
      const name = sanitizeForDisplay(change.name);
      const fromVersion = sanitizeForDisplay(change.fromVersion ?? 'n/a');
      const toVersion = sanitizeForDisplay(change.toVersion ?? 'n/a');
      lines.push(`- ${name}: ${change.changeType} (${fromVersion} → ${toVersion})${delta}`);
    }
  }
  lines.push('');
  lines.push('## Findings');
  if (result.findings.length === 0) {
    lines.push('- None');
  } else {
    for (const finding of result.findings) {
      const title = sanitizeForDisplay(finding.title);
      const summary = sanitizeForDisplay(finding.summary);
      const evidence = finding.evidence.map((entry) => sanitizeForDisplay(entry));
      const policySource = finding.policySource ? sanitizeForDisplay(finding.policySource) : undefined;
      const recommendation = sanitizeForDisplay(finding.recommendation);

      lines.push(`- [${finding.severity}] ${title} (score ${finding.score})`);
      lines.push(`  - ${summary}`);
      if (evidence.length > 0) {
        lines.push(`  - Evidence: ${evidence.join('; ')}`);
      }
      if (policySource) {
        lines.push(`  - Policy: ${policySource}`);
      }
      lines.push(`  - Recommendation: ${recommendation}`);
    }
  }
  return `${lines.join(String.fromCharCode(10))}${String.fromCharCode(10)}`;
}

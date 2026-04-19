import type { FinalAnalysisResult } from '@drr/shared';

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
      lines.push(`- ${change.name}: ${change.changeType} (${change.fromVersion ?? 'n/a'} → ${change.toVersion ?? 'n/a'})${delta}`);
    }
  }
  lines.push('');
  lines.push('## Findings');
  if (result.findings.length === 0) {
    lines.push('- None');
  } else {
    for (const finding of result.findings) {
      lines.push(`- [${finding.severity}] ${finding.title} (score ${finding.score})`);
      lines.push(`  - ${finding.summary}`);
      if (finding.evidence.length > 0) {
        lines.push(`  - Evidence: ${finding.evidence.join('; ')}`);
      }
      if (finding.policySource) {
        lines.push(`  - Policy: ${finding.policySource}`);
      }
      lines.push(`  - Recommendation: ${finding.recommendation}`);
    }
  }
  return `${lines.join(String.fromCharCode(10))}${String.fromCharCode(10)}`;
}

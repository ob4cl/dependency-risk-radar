import type { FinalAnalysisResult } from '@drr/shared';

export function renderJsonReport(result: FinalAnalysisResult): string {
  return `${JSON.stringify(result, null, 2)}
`;
}

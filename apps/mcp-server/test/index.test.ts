import { describe, expect, it, vi } from 'vitest';
import type { FinalAnalysisResult } from '@drr/shared';
import {
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
  TOOL_ANALYZE_DEPENDENCY_DIFF,
  TOOL_EXPLAIN_PACKAGE_RISK,
  TOOL_GENERATE_POLICY_FILE,
  TOOL_REVIEW_PULL_REQUEST_DEPENDENCIES,
  createDependencyRiskRadarServer,
  mcpToolNames,
} from '../src/index';

function makeAnalysisResult(overrides: Partial<FinalAnalysisResult> = {}): FinalAnalysisResult {
  return {
    analysisVersion: '0.1.0',
    repoPath: '/tmp/repo',
    baseRef: 'main',
    headRef: 'head',
    generatedAt: '2026-04-19T00:00:00.000Z',
    summary: {
      totalPackagesReviewed: 1,
      changedDirectDependencies: 1,
      changedTransitiveDependencies: 0,
      criticalFindings: 0,
      highFindings: 0,
      mediumFindings: 0,
      lowFindings: 0,
      totalRiskScore: 12,
      decision: 'pass',
    },
    dependencyChanges: [
      {
        ecosystem: 'npm',
        name: 'react',
        changeType: 'upgraded',
        fromVersion: '18.2.0',
        toVersion: '19.1.0',
        direct: true,
        manifestPath: 'package.json',
        lockfilePath: 'package-lock.json',
        workspace: null,
        metadata: {},
      },
    ],
    findings: [],
    markdownReport: '# Dependency Risk Radar\n\nAll clear.',
    policyApplied: false,
    exitCodeRecommendation: 0,
    ...overrides,
  };
}

describe('mcp server registration', () => {
  it('registers the expected tool names and schemas', () => {
    const analyzeRepository = vi.fn().mockResolvedValue(makeAnalysisResult());
    const { app, server } = createDependencyRiskRadarServer({
      analyzeRepository,
      serializeAnalysis: vi.fn((result) => ({ json: JSON.stringify(result), markdown: result.markdownReport })),
    });

    expect(server).toBeDefined();
    expect(MCP_SERVER_NAME).toBe('dependency-risk-radar');
    expect(MCP_SERVER_VERSION).toBe('0.1.0');
    expect(app.listTools().tools.map((tool) => tool.name)).toEqual(mcpToolNames);
  });
});

describe('mcp tool handlers', () => {
  it('analyze_dependency_diff returns a serialized analysis envelope', async () => {
    const analysis = makeAnalysisResult();
    const analyzeRepository = vi.fn().mockResolvedValue(analysis);
    const serializeAnalysis = vi.fn((result) => ({ json: JSON.stringify({ version: result.analysisVersion }), markdown: result.markdownReport }));
    const { app } = createDependencyRiskRadarServer({ analyzeRepository, serializeAnalysis });

    const result = await app.callTool(TOOL_ANALYZE_DEPENDENCY_DIFF, {
      repoPath: '/repo',
      baseRef: 'main',
      headRef: 'head',
    });

    expect(analyzeRepository).toHaveBeenCalledWith({
      repoPath: '/repo',
      baseRef: 'main',
      headRef: 'head',
      policyPath: null,
      liveMetadata: false,
      allowedWorkspaceRoot: process.cwd(),
      allowedConfigRoot: process.cwd(),
    });

    const payload = JSON.parse(result.content[0]!.text) as { tool: string; summary: { decision: string }; report: { json: string } };
    expect(payload.tool).toBe(TOOL_ANALYZE_DEPENDENCY_DIFF);
    expect(payload.summary.decision).toBe('pass');
    expect(payload.report.json).toContain('0.1.0');
  });

  it('falls back to offline analysis when live metadata is unavailable', async () => {
    const analysis = makeAnalysisResult();
    const analyzeRepository = vi.fn()
      .mockRejectedValueOnce(new Error('provider unavailable'))
      .mockResolvedValueOnce(analysis);
    const { app } = createDependencyRiskRadarServer({
      analyzeRepository,
      serializeAnalysis: vi.fn((result) => ({ json: JSON.stringify({ version: result.analysisVersion }), markdown: result.markdownReport })),
    });

    const result = await app.callTool(TOOL_ANALYZE_DEPENDENCY_DIFF, {
      repoPath: '/repo',
      baseRef: 'main',
      headRef: 'head',
      liveMetadata: true,
    });

    expect(analyzeRepository).toHaveBeenCalledTimes(2);
    const payload = JSON.parse(result.content[0]!.text) as { metadataMode: string; metadataFallbackReason?: string };
    expect(payload.metadataMode).toBe('offline-fallback');
    expect(payload.metadataFallbackReason).toContain('provider unavailable');
  });


  it('review_pull_request_dependencies returns a PR-focused analysis envelope', async () => {
    const analysis = makeAnalysisResult({ summary: { ...makeAnalysisResult().summary, decision: 'warn' } });
    const analyzeRepository = vi.fn().mockResolvedValue(analysis);
    const { app } = createDependencyRiskRadarServer({
      analyzeRepository,
      serializeAnalysis: vi.fn((result) => ({ json: JSON.stringify({ version: result.analysisVersion }), markdown: result.markdownReport })),
    });

    const result = await app.callTool(TOOL_REVIEW_PULL_REQUEST_DEPENDENCIES, {
      repoPath: '/repo',
      baseRef: 'main',
      headRef: 'head',
      pullRequestNumber: 42,
      pullRequestTitle: 'Update dependencies',
      pullRequestUrl: 'https://example.invalid/pr/42',
    });

    expect(analyzeRepository).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(result.content[0]!.text) as { tool: string; pullRequest: { number: number | null; title: string | null; url: string | null } };
    expect(payload.tool).toBe(TOOL_REVIEW_PULL_REQUEST_DEPENDENCIES);
    expect(payload.pullRequest).toEqual({
      number: 42,
      title: 'Update dependencies',
      url: 'https://example.invalid/pr/42',
    });
  });

  it('explain_package_risk returns a deterministic offline risk explanation', async () => {
    const { app } = createDependencyRiskRadarServer({
      analyzeRepository: vi.fn().mockResolvedValue(makeAnalysisResult()),
      serializeAnalysis: vi.fn((result) => ({ json: JSON.stringify(result), markdown: result.markdownReport })),
    });

    const result = await app.callTool(TOOL_EXPLAIN_PACKAGE_RISK, {
      ecosystem: 'npm',
      packageName: 'demo-package',
      version: '1.2.3',
      metadata: {
        hasInstallScript: true,
        nativeBuild: true,
        repository: 'https://github.com/example/demo-package',
      },
    });

    const payload = JSON.parse(result.content[0]!.text) as {
      tool: string;
      explanation: { riskScore: number; verdict: string; offline: boolean; signals: Array<{ kind: string }> };
    };

    expect(payload.tool).toBe(TOOL_EXPLAIN_PACKAGE_RISK);
    expect(payload.explanation.offline).toBe(false);
    expect(payload.explanation.riskScore).toBeGreaterThan(0);
    expect(payload.explanation.signals.map((signal) => signal.kind)).toContain('install-script');
  });

  it('generate_policy_file returns a starter yaml policy string', async () => {
    const { app } = createDependencyRiskRadarServer({
      analyzeRepository: vi.fn().mockResolvedValue(makeAnalysisResult()),
      serializeAnalysis: vi.fn((result) => ({ json: JSON.stringify(result), markdown: result.markdownReport })),
    });

    const result = await app.callTool(TOOL_GENERATE_POLICY_FILE, {});
    const payload = JSON.parse(result.content[0]!.text) as { tool: string; policyYaml: string };

    expect(payload.tool).toBe(TOOL_GENERATE_POLICY_FILE);
    expect(payload.policyYaml).toContain('thresholds:');
    expect(payload.policyYaml).toContain('block_score: 70');
    expect(payload.policyYaml).toContain('example-banned-package');
  });
});

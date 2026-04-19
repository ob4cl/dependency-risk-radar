import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { analyzeRepository, serializeAnalysis } from '@drr/core';
import { packageMetadataSchema, analysisInputSchema } from '@drr/shared';
import { z } from 'zod';

export const MCP_SERVER_NAME = 'dependency-risk-radar';
export const MCP_SERVER_VERSION = '0.1.0';

export const TOOL_ANALYZE_DEPENDENCY_DIFF = 'analyze_dependency_diff';
export const TOOL_EXPLAIN_PACKAGE_RISK = 'explain_package_risk';
export const TOOL_REVIEW_PULL_REQUEST_DEPENDENCIES = 'review_pull_request_dependencies';
export const TOOL_GENERATE_POLICY_FILE = 'generate_policy_file';

export const mcpToolNames = [
  TOOL_ANALYZE_DEPENDENCY_DIFF,
  TOOL_EXPLAIN_PACKAGE_RISK,
  TOOL_REVIEW_PULL_REQUEST_DEPENDENCIES,
  TOOL_GENERATE_POLICY_FILE,
] as const;

const explainPackageRiskInputSchema = z.object({
  ecosystem: z.enum(['npm', 'pnpm']),
  packageName: z.string().min(1),
  version: z.string().min(1).nullable().optional(),
  metadata: packageMetadataSchema.optional(),
}).strict();

const generatePolicyFileInputSchema = z.object({}).strict();

const analyzeDependencyDiffInputSchema = analysisInputSchema.strict();

const reviewPullRequestDependenciesInputSchema = analysisInputSchema.extend({
  pullRequestNumber: z.number().int().positive().optional(),
  pullRequestTitle: z.string().min(1).optional(),
  pullRequestUrl: z.string().url().optional(),
}).strict();

type ToolName = typeof mcpToolNames[number];

type AnalyzeDependencyDiffInput = z.infer<typeof analyzeDependencyDiffInputSchema>;
type ToolHandler<Input> = (input: Input) => Promise<Record<string, unknown>> | Record<string, unknown>;

interface ToolDefinition<Input> {
  name: ToolName;
  description: string;
  inputSchema: Record<string, unknown>;
  validate: (input: unknown) => Input;
  handler: ToolHandler<Input>;
}

interface AnalysisDependencies {
  analyzeRepository: typeof analyzeRepository;
  serializeAnalysis: typeof serializeAnalysis;
}

interface ExplainPackageRiskInput {
  ecosystem: 'npm' | 'pnpm';
  packageName: string;
  version?: string | null;
  metadata?: z.infer<typeof packageMetadataSchema>;
}

interface ReviewPullRequestDependenciesInput {
  repoPath: string;
  baseRef: string;
  headRef: string;
  policyPath?: string | null;
  liveMetadata?: boolean;
  pullRequestNumber?: number;
  pullRequestTitle?: string;
  pullRequestUrl?: string;
}

interface DependencyRiskRadarMcpApp {
  tools: readonly ToolDefinition<any>[];
  listTools: () => { tools: Array<{ name: ToolName; description: string; inputSchema: Record<string, unknown> }> };
  callTool: (name: ToolName, input: unknown) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>;
}

interface ServerBundle {
  server: Server;
  app: DependencyRiskRadarMcpApp;
}

function buildStarterPolicyYaml(): string {
  return [
    'ecosystems:',
    '  npm:',
    '    enabled: true',
    '  pnpm:',
    '    enabled: true',
    '',
    'thresholds:',
    '  block_score: 70',
    '  warn_score: 40',
    '',
    'policies:',
    '  block_known_critical_vulns: true',
    '  require_lockfile: true',
    '  require_manual_review_for_install_scripts: true',
    '',
    'licenses:',
    '  deny:',
    '    - GPL-3.0',
    '    - AGPL-3.0',
    '',
    'packages:',
    '  deny:',
    '    - example-banned-package',
    '',
  ].join('\n');
}

function textContent(payload: Record<string, unknown>): { content: Array<{ type: 'text'; text: string }> } {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
  };
}

function explainPackageRisk(input: ExplainPackageRiskInput): Record<string, unknown> {
  const metadata = input.metadata ?? null;
  const signals: Array<{ kind: string; weight: number; description: string }> = [];
  let riskScore = 0;

  if (!metadata) {
    signals.push({ kind: 'offline', weight: 0, description: 'No live package metadata supplied; using offline-only explanation.' });
  }

  if (metadata?.hasInstallScript) {
    signals.push({ kind: 'install-script', weight: 25, description: 'Package declares an install script.' });
    riskScore += 25;
  }

  if (metadata?.hasPreinstallScript) {
    signals.push({ kind: 'preinstall-script', weight: 20, description: 'Package declares a preinstall script.' });
    riskScore += 20;
  }

  if (metadata?.hasPostinstallScript) {
    signals.push({ kind: 'postinstall-script', weight: 20, description: 'Package declares a postinstall script.' });
    riskScore += 20;
  }

  if (metadata?.hasPrepareScript) {
    signals.push({ kind: 'prepare-script', weight: 10, description: 'Package declares a prepare script.' });
    riskScore += 10;
  }

  if (metadata?.nativeBuild) {
    signals.push({ kind: 'native-build', weight: 10, description: 'Package is marked as needing a native build.' });
    riskScore += 10;
  }

  if (metadata?.repository) {
    signals.push({ kind: 'repository', weight: 0, description: `Repository: ${metadata.repository}` });
  }

  if (metadata?.license) {
    signals.push({ kind: 'license', weight: 0, description: `License: ${metadata.license}` });
  }

  const verdict = riskScore >= 40 ? 'high' : riskScore >= 20 ? 'medium' : 'low';
  const explanation = metadata
    ? 'Risk explanation derived from package metadata and deterministic heuristics.'
    : 'Offline explanation derived from package identity only; supply metadata for a deeper review.';

  return {
    tool: TOOL_EXPLAIN_PACKAGE_RISK,
    package: {
      ecosystem: input.ecosystem,
      name: input.packageName,
      version: input.version ?? null,
    },
    offline: metadata === null,
    riskScore,
    verdict,
    signals,
    explanation,
  };
}

function createAnalysisEnvelope(
  name: typeof TOOL_ANALYZE_DEPENDENCY_DIFF | typeof TOOL_REVIEW_PULL_REQUEST_DEPENDENCIES,
  result: Awaited<ReturnType<typeof analyzeRepository>>,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const serialized = serializeAnalysis(result);
  return {
    tool: name,
    summary: result.summary,
    decision: result.summary.decision,
    exitCodeRecommendation: result.exitCodeRecommendation,
    policyApplied: result.policyApplied,
    generatedAt: result.generatedAt,
    dependencyCount: result.dependencyChanges.length,
    findings: result.findings,
    report: serialized,
    ...extra,
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function analyzeDependencyDiffWithGracefulFallback(
  deps: AnalysisDependencies,
  input: AnalyzeDependencyDiffInput | ReviewPullRequestDependenciesInput,
): Promise<{ result: Awaited<ReturnType<typeof analyzeRepository>>; metadataMode: 'offline' | 'live' | 'offline-fallback'; metadataFallbackReason?: string }> {
  const normalizedInput = {
    repoPath: input.repoPath,
    baseRef: input.baseRef,
    headRef: input.headRef,
    policyPath: input.policyPath ?? null,
  };

  if (!input.liveMetadata) {
    return {
      result: await deps.analyzeRepository({ ...normalizedInput, liveMetadata: false }),
      metadataMode: 'offline',
    };
  }

  try {
    return {
      result: await deps.analyzeRepository({ ...normalizedInput, liveMetadata: true }),
      metadataMode: 'live',
    };
  } catch (error) {
    return {
      result: await deps.analyzeRepository({ ...normalizedInput, liveMetadata: false }),
      metadataMode: 'offline-fallback',
      metadataFallbackReason: getErrorMessage(error),
    };
  }
}

function createDependencyRiskRadarApp(deps: AnalysisDependencies = { analyzeRepository, serializeAnalysis }): DependencyRiskRadarMcpApp {
  const toolDefinitions: readonly ToolDefinition<any>[] = [
    {
      name: TOOL_ANALYZE_DEPENDENCY_DIFF,
      description: 'Analyze dependency changes between two git refs using the local analysis engine.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          repoPath: { type: 'string' },
          baseRef: { type: 'string' },
          headRef: { type: 'string' },
          policyPath: { type: ['string', 'null'] },
          liveMetadata: { type: 'boolean' },
        },
        required: ['repoPath', 'baseRef', 'headRef'],
      },
      validate: (input: unknown) => analyzeDependencyDiffInputSchema.parse(input),
      handler: async (input: ReturnType<typeof analyzeDependencyDiffInputSchema.parse>) => {
        const analysis = await analyzeDependencyDiffWithGracefulFallback(deps, input);

        return textContent(createAnalysisEnvelope(TOOL_ANALYZE_DEPENDENCY_DIFF, analysis.result, {
          metadataMode: analysis.metadataMode,
          metadataFallbackReason: analysis.metadataFallbackReason ?? null,
        }));
      },
    },
    {
      name: TOOL_EXPLAIN_PACKAGE_RISK,
      description: 'Explain the risk profile of a single package using deterministic offline heuristics.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ecosystem: { type: 'string', enum: ['npm', 'pnpm'] },
          packageName: { type: 'string' },
          version: { type: ['string', 'null'] },
          metadata: {
            type: 'object',
            additionalProperties: false,
            properties: {
              hasInstallScript: { type: 'boolean' },
              hasPreinstallScript: { type: 'boolean' },
              hasPostinstallScript: { type: 'boolean' },
              hasPrepareScript: { type: 'boolean' },
              nativeBuild: { type: 'boolean' },
              repository: { type: ['string', 'null'] },
              license: { type: ['string', 'null'] },
              homepage: { type: ['string', 'null'] },
              description: { type: ['string', 'null'] },
              extra: { type: 'object' },
            },
          },
        },
        required: ['ecosystem', 'packageName'],
      },
      validate: (input: unknown) => explainPackageRiskInputSchema.parse(input),
      handler: async (input: ExplainPackageRiskInput) => textContent({
        tool: TOOL_EXPLAIN_PACKAGE_RISK,
        explanation: explainPackageRisk(input),
      }),
    },
    {
      name: TOOL_REVIEW_PULL_REQUEST_DEPENDENCIES,
      description: 'Review a pull request by analyzing dependency changes between the base and head refs.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          repoPath: { type: 'string' },
          baseRef: { type: 'string' },
          headRef: { type: 'string' },
          policyPath: { type: ['string', 'null'] },
          liveMetadata: { type: 'boolean' },
          pullRequestNumber: { type: 'integer', minimum: 1 },
          pullRequestTitle: { type: 'string' },
          pullRequestUrl: { type: 'string' },
        },
        required: ['repoPath', 'baseRef', 'headRef'],
      },
      validate: (input: unknown) => reviewPullRequestDependenciesInputSchema.parse(input),
      handler: async (input: ReviewPullRequestDependenciesInput) => {
        const analysis = await analyzeDependencyDiffWithGracefulFallback(deps, input);

        return textContent(createAnalysisEnvelope(TOOL_REVIEW_PULL_REQUEST_DEPENDENCIES, analysis.result, {
          metadataMode: analysis.metadataMode,
          metadataFallbackReason: analysis.metadataFallbackReason ?? null,
          pullRequest: {
            number: input.pullRequestNumber ?? null,
            title: input.pullRequestTitle ?? null,
            url: input.pullRequestUrl ?? null,
          },
        }));
      },
    },
    {
      name: TOOL_GENERATE_POLICY_FILE,
      description: 'Generate a starter policy file that can be edited locally and written to disk by the user.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {},
      },
      validate: (input: unknown) => generatePolicyFileInputSchema.parse(input),
      handler: async () => textContent({
        tool: TOOL_GENERATE_POLICY_FILE,
        policyYaml: buildStarterPolicyYaml(),
      }),
    },
  ] as const;

  return {
    tools: toolDefinitions,
    listTools: () => ({
      tools: toolDefinitions.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    }),
    callTool: async (name: ToolName, input: unknown) => {
      const tool = toolDefinitions.find((definition) => definition.name === name);
      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }

      const parsed = tool.validate(input);
      return tool.handler(parsed as never) as Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>;
    },
  };
}

export function createDependencyRiskRadarServer(deps: AnalysisDependencies = { analyzeRepository, serializeAnalysis }): ServerBundle {
  const app = createDependencyRiskRadarApp(deps);
  const server = new Server(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => app.listTools());
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name as ToolName;
    const result = await app.callTool(name, request.params.arguments ?? {});
    return result;
  });

  return { server, app };
}

export async function main(): Promise<void> {
  const { server } = createDependencyRiskRadarServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

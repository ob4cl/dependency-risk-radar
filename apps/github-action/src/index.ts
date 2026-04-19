import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeRepository, serializeAnalysis } from '@drr/core';
import type { AnalysisInput, FinalAnalysisResult } from '@drr/shared';

export type ActionOutputFormat = 'json' | 'markdown' | 'both';

export interface ActionInputs extends AnalysisInput {
  format: ActionOutputFormat;
}

const DEFAULT_FORMAT: ActionOutputFormat = 'both';

function collectInputKeys(name: string): string[] {
  const normalized = name.toUpperCase();
  return [
    `INPUT_${normalized}`,
    `INPUT_${normalized.replace(/[- ]/g, '_')}`,
  ];
}

function readInput(name: string): string | undefined {
  for (const key of collectInputKeys(name)) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function readBooleanInput(name: string, defaultValue = false): boolean {
  const value = readInput(name);
  if (typeof value === 'undefined') {
    return defaultValue;
  }
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function normalizeFormat(value: string | undefined): ActionOutputFormat {
  const normalized = (value ?? DEFAULT_FORMAT).toLowerCase();
  if (normalized === 'json' || normalized === 'markdown' || normalized === 'both') {
    return normalized;
  }
  throw new Error(`Unsupported action format: ${value}`);
}

function parseGitHubEvent(): Record<string, unknown> | null {
  const eventPath = process.env['GITHUB_EVENT_PATH'];
  if (!eventPath || !existsSync(eventPath)) {
    return null;
  }
  const parsed = JSON.parse(readFileSync(eventPath, 'utf8')) as Record<string, unknown>;
  return parsed;
}

function resolveWorkspaceRoot(): string {
  return resolve(process.env['GITHUB_WORKSPACE'] ?? process.cwd());
}

function resolveRepoPath(input: string | undefined, workspace: string): string {
  return resolve(workspace, input ?? '.');
}

function resolveRefFromEvent(event: Record<string, unknown> | null, key: 'base' | 'head'): string | undefined {
  if (!event) {
    return undefined;
  }

  const pullRequest = event['pull_request'] as Record<string, unknown> | undefined;
  if (pullRequest) {
    const side = pullRequest[key] as Record<string, unknown> | undefined;
    const sha = side?.['sha'];
    if (typeof sha === 'string' && sha.trim().length > 0) {
      return sha.trim();
    }
  }

  if (key === 'base') {
    const before = event['before'];
    if (typeof before === 'string' && before.trim().length > 0) {
      return before.trim();
    }
  }

  if (key === 'head') {
    const after = event['after'];
    if (typeof after === 'string' && after.trim().length > 0) {
      return after.trim();
    }
  }

  return undefined;
}

function resolveInputRef(name: 'base' | 'head', fallbackEvent: Record<string, unknown> | null, explicitValue: string | undefined): string {
  const value = explicitValue ?? resolveRefFromEvent(fallbackEvent, name);
  if (!value) {
    throw new Error(`Missing required action input: ${name}. Provide it directly or ensure the GitHub event payload contains it.`);
  }
  return value;
}

export function readActionInputs(partial: Partial<ActionInputs> = {}): ActionInputs {
  const event = parseGitHubEvent();
  const workspaceRoot = resolveWorkspaceRoot();
  return {
    repoPath: resolveRepoPath(partial.repoPath ?? readInput('repo'), workspaceRoot),
    baseRef: resolveInputRef('base', event, partial.baseRef ?? readInput('base')),
    headRef: resolveInputRef('head', event, partial.headRef ?? readInput('head')),
    policyPath: partial.policyPath ?? readInput('policy') ?? null,
    format: normalizeFormat(partial.format ?? readInput('format')),
    liveMetadata: typeof partial.liveMetadata === 'boolean' ? partial.liveMetadata : readBooleanInput('live-metadata', false),
    allowedWorkspaceRoot: partial.allowedWorkspaceRoot ?? workspaceRoot,
    allowedConfigRoot: partial.allowedConfigRoot ?? workspaceRoot,
  };
}

function writeOutput(name: string, value: string): void {
  const outputPath = process.env['GITHUB_OUTPUT'];
  if (!outputPath) {
    return;
  }
  const delimiter = `drr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  appendFileSync(outputPath, `${name}<<${delimiter}\n${value}\n${delimiter}\n`, 'utf8');
}

function writeStepSummary(markdown: string): void {
  const summaryPath = process.env['GITHUB_STEP_SUMMARY'];
  if (!summaryPath) {
    return;
  }
  appendFileSync(summaryPath, `${markdown}\n`, 'utf8');
}

function sanitizeWorkflowCommands(text: string): string {
  return text.replace(/::/g, '%3A%3A');
}

function writeConciseLog(result: FinalAnalysisResult): void {
  const line = `Dependency Risk Radar: decision=${result.summary.decision} score=${result.summary.totalRiskScore}`;
  process.stdout.write(`${sanitizeWorkflowCommands(line)}\n`);
}

export async function runAction(partialInputs?: Partial<ActionInputs>): Promise<FinalAnalysisResult> {
  const inputs = readActionInputs(partialInputs);
  const analysisInput: AnalysisInput = {
    repoPath: inputs.repoPath,
    baseRef: inputs.baseRef,
    headRef: inputs.headRef,
  };
  if (typeof inputs.liveMetadata === 'boolean') {
    analysisInput.liveMetadata = inputs.liveMetadata;
  }
  if (typeof inputs.policyPath === 'string' && inputs.policyPath.length > 0) {
    analysisInput.policyPath = inputs.policyPath;
  }
  if (typeof inputs.allowedWorkspaceRoot === 'string' && inputs.allowedWorkspaceRoot.length > 0) {
    analysisInput.allowedWorkspaceRoot = inputs.allowedWorkspaceRoot;
  }
  if (typeof inputs.allowedConfigRoot === 'string' && inputs.allowedConfigRoot.length > 0) {
    analysisInput.allowedConfigRoot = inputs.allowedConfigRoot;
  }
  const result = await analyzeRepository(analysisInput);

  const { json, markdown } = serializeAnalysis(result);
  writeOutput('json', json);
  writeOutput('markdown', markdown);
  writeOutput('decision', result.summary.decision);
  writeOutput('score', String(result.summary.totalRiskScore));
  writeOutput('exit-code-recommendation', String(result.exitCodeRecommendation));
  writeStepSummary(markdown);
  writeConciseLog(result);
  return result;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function main(): Promise<void> {
  try {
    const result = await runAction();
    process.exitCode = result.exitCodeRecommendation;
  } catch (error) {
    process.stderr.write(`${sanitizeWorkflowCommands(formatError(error))}\n`);
    process.exitCode = 1;
  }
}

const isDirectExecution = typeof process.argv[1] === 'string' && process.argv[1].endsWith('/dist/index.js');
if (isDirectExecution) {
  void main();
}

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AnalysisInput, FinalAnalysisResult } from '@drr/shared';
import { MissingLockfileError, InvalidReferenceError, PolicyValidationError } from '@drr/shared';
import { assertDirectoryWithinRoots, assertFileWithinRoots, PathUnreadableError } from '@drr/shared';
import { parsePackageJson, parseLockfile, generateDependencyDelta } from '@drr/parsers';
import { parsePolicyYaml, defaultPolicyConfig, policyToScoringConfig } from '@drr/policy';
import { scoreDependencyChanges } from '@drr/scoring';
import { renderJsonReport, renderMarkdownReport } from '@drr/reporters';
import { createLiveProviderBundle, enrichDependencyChanges } from '@drr/providers';

interface ResolvedRepoFiles {
  manifestPath: string;
  lockfilePath: string | null;
}

function resolveWorkspaceRoot(input: AnalysisInput): string {
  const workspaceRoot = input.allowedWorkspaceRoot ?? process.env['DRR_WORKSPACE_ROOT'] ?? process.cwd();
  return assertDirectoryWithinRoots({
    kind: 'workspaceRoot',
    path: workspaceRoot,
    allowedRoots: [workspaceRoot],
  });
}

function resolveConfigRoot(input: AnalysisInput, workspaceRoot: string, repoPath: string): string {
  if (!input.allowedConfigRoot) {
    return repoPath;
  }

  return assertDirectoryWithinRoots({
    kind: 'configRoot',
    path: input.allowedConfigRoot,
    allowedRoots: [workspaceRoot],
  });
}

function gitShow(repoPath: string, ref: string, filePath: string): string {
  try {
    return execFileSync('git', ['show', `${ref}:${filePath}`], { cwd: repoPath, encoding: 'utf8' });
  } catch (error) {
    throw new InvalidReferenceError(ref, { filePath, error: error instanceof Error ? error.message : String(error) });
  }
}

function gitFileExists(repoPath: string, ref: string, filePath: string): boolean {
  try {
    execFileSync('git', ['cat-file', '-e', `${ref}:${filePath}`], { cwd: repoPath, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function discoverLockfile(repoPath: string, ref: string): string | null {
  if (gitFileExists(repoPath, ref, 'package-lock.json')) return 'package-lock.json';
  if (gitFileExists(repoPath, ref, 'pnpm-lock.yaml')) return 'pnpm-lock.yaml';
  return null;
}

function resolveFiles(repoPath: string, ref: string): ResolvedRepoFiles {
  if (!gitFileExists(repoPath, ref, 'package.json')) {
    throw new InvalidReferenceError(ref, { filePath: 'package.json' });
  }
  return {
    manifestPath: 'package.json',
    lockfilePath: discoverLockfile(repoPath, ref),
  };
}

function safeParseManifest(repoPath: string, ref: string) {
  const text = gitShow(repoPath, ref, 'package.json');
  return parsePackageJson(text, join(repoPath, 'package.json'));
}

function safeParseLockfile(repoPath: string, ref: string, lockfilePath: string | null) {
  if (!lockfilePath) return null;
  const text = gitShow(repoPath, ref, lockfilePath);
  return parseLockfile(text, join(repoPath, lockfilePath));
}

function loadPolicy(input: AnalysisInput, repoPath: string, configRoot: string) {
  if (!input.policyPath) {
    return defaultPolicyConfig;
  }

  const policyPath = assertFileWithinRoots({
    kind: 'policyPath',
    path: input.policyPath,
    allowedRoots: [repoPath, configRoot],
  });

  try {
    return parsePolicyYaml(readFileSync(policyPath, 'utf8'));
  } catch (error) {
    if (error instanceof PolicyValidationError) {
      throw error;
    }
    if (error instanceof PathUnreadableError) {
      throw error;
    }
    throw new PathUnreadableError(policyPath, { kind: 'policyPath', error: error instanceof Error ? error.message : String(error) });
  }
}

export async function analyzeRepository(input: AnalysisInput): Promise<FinalAnalysisResult> {
  const workspaceRoot = resolveWorkspaceRoot(input);
  const repoPath = assertDirectoryWithinRoots({
    kind: 'repoPath',
    path: input.repoPath,
    allowedRoots: [workspaceRoot],
  });
  const configRoot = resolveConfigRoot(input, workspaceRoot, repoPath);
  const baseFiles = resolveFiles(repoPath, input.baseRef);
  const headFiles = resolveFiles(repoPath, input.headRef);
  const baseManifest = safeParseManifest(repoPath, input.baseRef);
  const headManifest = safeParseManifest(repoPath, input.headRef);
  const lockfilePath = headFiles.lockfilePath ?? baseFiles.lockfilePath;
  if (!lockfilePath && !baseFiles.lockfilePath && !headFiles.lockfilePath) {
    throw new MissingLockfileError(repoPath);
  }

  const baseLockfile = safeParseLockfile(repoPath, input.baseRef, baseFiles.lockfilePath ?? lockfilePath);
  const headLockfile = safeParseLockfile(repoPath, input.headRef, headFiles.lockfilePath ?? lockfilePath);

  let dependencyChanges = generateDependencyDelta({
    base: { manifest: baseManifest, lockfile: baseLockfile },
    head: { manifest: headManifest, lockfile: headLockfile },
  });

  if (input.liveMetadata) {
    dependencyChanges = await enrichDependencyChanges(dependencyChanges, createLiveProviderBundle());
  }

  const policy = loadPolicy(input, repoPath, configRoot);
  const scoringConfig = policyToScoringConfig(policy);
  const scoreResult = scoreDependencyChanges(dependencyChanges, scoringConfig);
  const result: FinalAnalysisResult = {
    analysisVersion: '0.1.0',
    repoPath,
    baseRef: input.baseRef,
    headRef: input.headRef,
    generatedAt: new Date().toISOString(),
    summary: scoreResult.summary,
    dependencyChanges,
    findings: scoreResult.findings,
    markdownReport: '',
    policyApplied: Boolean(input.policyPath),
    exitCodeRecommendation: scoreResult.summary.decision === 'fail' ? 1 : scoreResult.summary.decision === 'high-risk' ? 1 : scoreResult.summary.decision === 'warn' ? 0 : 0,
  };
  result.markdownReport = renderMarkdownReport(result);
  return result;
}

export function serializeAnalysis(result: FinalAnalysisResult): { json: string; markdown: string } {
  return {
    json: renderJsonReport(result),
    markdown: result.markdownReport,
  };
}

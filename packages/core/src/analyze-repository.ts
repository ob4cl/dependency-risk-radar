import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AnalysisInput, FinalAnalysisResult } from '@drr/shared';
import { MissingLockfileError, InvalidReferenceError } from '@drr/shared';
import { parsePackageJson, parseLockfile, generateDependencyDelta } from '@drr/parsers';
import { parsePolicyYaml, defaultPolicyConfig, policyToScoringConfig } from '@drr/policy';
import { scoreDependencyChanges } from '@drr/scoring';
import { renderJsonReport, renderMarkdownReport } from '@drr/reporters';
import { createLiveProviderBundle, createOfflineProviderBundle, enrichDependencyChanges } from '../../providers/src/index';

interface ResolvedRepoFiles {
  manifestPath: string;
  lockfilePath: string | null;
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

export async function analyzeRepository(input: AnalysisInput): Promise<FinalAnalysisResult> {
  const baseFiles = resolveFiles(input.repoPath, input.baseRef);
  const headFiles = resolveFiles(input.repoPath, input.headRef);
  const baseManifest = safeParseManifest(input.repoPath, input.baseRef);
  const headManifest = safeParseManifest(input.repoPath, input.headRef);
  const lockfilePath = headFiles.lockfilePath ?? baseFiles.lockfilePath;
  if (!lockfilePath && !baseFiles.lockfilePath && !headFiles.lockfilePath) {
    throw new MissingLockfileError(input.repoPath);
  }

  const baseLockfile = safeParseLockfile(input.repoPath, input.baseRef, baseFiles.lockfilePath ?? lockfilePath);
  const headLockfile = safeParseLockfile(input.repoPath, input.headRef, headFiles.lockfilePath ?? lockfilePath);

  let dependencyChanges = generateDependencyDelta({
    base: { manifest: baseManifest, lockfile: baseLockfile },
    head: { manifest: headManifest, lockfile: headLockfile },
  });

  if (input.liveMetadata) {
    dependencyChanges = await enrichDependencyChanges(dependencyChanges, createLiveProviderBundle());
  }

  const policy = input.policyPath && existsSync(input.policyPath)
    ? parsePolicyYaml(readFileSync(input.policyPath, 'utf8'))
    : defaultPolicyConfig;

  const scoringConfig = policyToScoringConfig(policy);
  const scoreResult = scoreDependencyChanges(dependencyChanges, scoringConfig);
  const result: FinalAnalysisResult = {
    analysisVersion: '0.1.0',
    repoPath: input.repoPath,
    baseRef: input.baseRef,
    headRef: input.headRef,
    generatedAt: new Date('2026-04-19T00:00:00.000Z').toISOString(),
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

import { Command } from 'commander';
import { writeFileSync } from 'node:fs';
import { analyzeRepository, serializeAnalysis } from '@drr/core';

type OutputFormat = 'json' | 'markdown' | 'both';

function buildStarterPolicy(): string {
  return [
    'ecosystems:',
    '  npm:',
    '    enabled: true',
    '  pnpm:',
    '    enabled: true',
    '',
    'thresholds:',
    '  block_score: 70',
    '  warn_score: 25',
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
  ].join(String.fromCharCode(10));
}

function normalizeFormat(value: string | undefined): OutputFormat {
  const normalized = value ?? 'both';
  if (normalized === 'json' || normalized === 'markdown' || normalized === 'both') {
    return normalized as OutputFormat;
  }
  throw new Error(`Unsupported output format: ${value}`);
}

function writeAnalysisOutput(result: Awaited<ReturnType<typeof analyzeRepository>>, format: OutputFormat): void {
  const { json, markdown } = serializeAnalysis(result);
  if (format === 'json') {
    process.stdout.write(json);
    return;
  }
  if (format === 'markdown') {
    process.stdout.write(markdown);
    return;
  }
  process.stdout.write(json);
  process.stdout.write(String.fromCharCode(10));
  process.stdout.write(markdown);
}

async function runAnalyze(options: { repo: string; base: string; head: string; policy?: string; format?: string; liveMetadata?: boolean; }): Promise<void> {
  const workspaceRoot = process.env['DRR_WORKSPACE_ROOT'] ?? process.cwd();
  const result = await analyzeRepository({
    repoPath: options.repo,
    baseRef: options.base,
    headRef: options.head,
    policyPath: options.policy ?? null,
    liveMetadata: Boolean(options.liveMetadata),
    allowedWorkspaceRoot: workspaceRoot,
    allowedConfigRoot: workspaceRoot,
  });
  writeAnalysisOutput(result, normalizeFormat(options.format));
  process.exitCode = result.exitCodeRecommendation;
}

async function runExplain(_ecosystem: string, packageRef: string): Promise<void> {
  process.stdout.write(JSON.stringify({
    package: packageRef,
    note: 'Use analyze --live-metadata for provider-backed enrichment.',
  }, null, 2));
  process.stdout.write(String.fromCharCode(10));
}

async function main(): Promise<void> {
  const program = new Command();
  program.name('radar').description('Dependency Risk Radar');

  program.command('analyze')
    .requiredOption('--repo <path>')
    .requiredOption('--base <ref>')
    .requiredOption('--head <ref>')
    .option('--policy <path>')
    .option('--format <format>', 'json | markdown | both', 'both')
    .option('--live-metadata', 'enable provider-backed metadata enrichment', false)
    .action(async (options) => {
      await runAnalyze(options);
    });

  program.command('review-pr')
    .requiredOption('--repo <path>')
    .requiredOption('--base <ref>')
    .requiredOption('--head <ref>')
    .option('--policy <path>')
    .option('--format <format>', 'json | markdown | both', 'both')
    .option('--live-metadata', 'enable provider-backed metadata enrichment', false)
    .action(async (options) => {
      await runAnalyze(options);
    });

  program.command('explain')
    .argument('<ecosystem>')
    .argument('<package>')
    .action(async (ecosystem: string, packageRef: string) => {
      await runExplain(ecosystem, packageRef);
    });

  program.command('init-policy')
    .option('--out <path>')
    .action((options) => {
      const text = buildStarterPolicy();
      if (options.out) {
        writeFileSync(options.out, text, 'utf8');
      } else {
        process.stdout.write(text);
      }
    });

  await program.parseAsync(process.argv);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}${String.fromCharCode(10)}`);
  process.exitCode = 2;
});

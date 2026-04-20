import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import YAML from 'yaml';
import { createGitRepoFixture } from '../../../tests/helpers/git-repo';
import { readActionInputs, runAction } from '../src/index';

const testFilePath = fileURLToPath(import.meta.url);
const testDir = dirname(testFilePath);
const repoRoot = resolve(testDir, '../../..');

const baseFiles = {
  'package.json': JSON.stringify({ name: 'demo', dependencies: { react: '^18.0.0' } }, null, 2),
  'package-lock.json': JSON.stringify({
    name: 'demo',
    lockfileVersion: 3,
    packages: {
      '': { dependencies: { react: '18.2.0' } },
      'node_modules/react': { name: 'react', version: '18.2.0' },
    },
  }, null, 2),
};

const headFiles = {
  'package.json': JSON.stringify({ name: 'demo', dependencies: { react: '^19.0.0' } }, null, 2),
  'package-lock.json': JSON.stringify({
    name: 'demo',
    lockfileVersion: 3,
    packages: {
      '': { dependencies: { react: '19.1.0' } },
      'node_modules/react': { name: 'react', version: '19.1.0' },
    },
  }, null, 2),
};

function parseGitHubOutputs(content: string): Record<string, string> {
  const outputs: Record<string, string> = {};
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) {
      continue;
    }
    const markerIndex = line.indexOf('<<');
    if (markerIndex === -1) {
      const equalsIndex = line.indexOf('=');
      if (equalsIndex !== -1) {
        outputs[line.slice(0, equalsIndex)] = line.slice(equalsIndex + 1);
      }
      continue;
    }
    const key = line.slice(0, markerIndex);
    const delimiter = line.slice(markerIndex + 2);
    const valueLines: string[] = [];
    while (++index < lines.length && lines[index] !== delimiter) {
      valueLines.push(lines[index] ?? '');
    }
    outputs[key] = valueLines.join('\n');
  }
  return outputs;
}

function createTempFile(name: string): string {
  return join(mkdtempSync(join(tmpdir(), 'drr-action-')), name);
}

describe('github action wrapper', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
    delete process.env.GITHUB_OUTPUT;
    delete process.env.GITHUB_STEP_SUMMARY;
    delete process.env.GITHUB_EVENT_PATH;
    delete process.env.GITHUB_WORKSPACE;
    delete process.env.INPUT_REPO;
    delete process.env.INPUT_FORMAT;
  });

  it('writes serialized outputs from local analysis without dumping raw json or markdown to stdout', async () => {
    const repo = createGitRepoFixture(baseFiles, headFiles);
    const outputPath = createTempFile('outputs.txt');
    const summaryPath = createTempFile('summary.md');
    process.env.GITHUB_OUTPUT = outputPath;
    process.env.GITHUB_STEP_SUMMARY = summaryPath;
    process.env.GITHUB_WORKSPACE = dirname(repo.repoPath);

    const result = await runAction({
      repoPath: repo.repoPath,
      baseRef: repo.baseRef,
      headRef: repo.headRef,
      format: 'markdown',
      liveMetadata: false,
    });

    const outputs = parseGitHubOutputs(readFileSync(outputPath, 'utf8'));
    expect(outputs.decision).toBe(result.summary.decision);
    expect(outputs.score).toBe(String(result.summary.totalRiskScore));
    expect(outputs['exit-code-recommendation']).toBe(String(result.exitCodeRecommendation));
    expect(outputs.json).toContain('"analysisVersion"');
    expect(outputs.markdown).toContain('# Dependency Risk Radar');
    expect(readFileSync(summaryPath, 'utf8')).toContain('# Dependency Risk Radar');

    const stdoutText = writeSpy.mock.calls.map((call) => String(call[0])).join('');
    expect(stdoutText).toContain('Dependency Risk Radar: decision=');
    expect(stdoutText).not.toContain('"analysisVersion"');
    expect(stdoutText).not.toContain('# Dependency Risk Radar');
  });

  it('resolves refs from the GitHub event payload when inputs are omitted', () => {
    const eventPath = createTempFile('event.json');
    writeFileSync(eventPath, JSON.stringify({
      pull_request: {
        base: { sha: 'base-sha-123' },
        head: { sha: 'head-sha-456' },
      },
    }), 'utf8');

    process.env.GITHUB_EVENT_PATH = eventPath;
    process.env.GITHUB_WORKSPACE = repoRoot;
    process.env.INPUT_REPO = '.';
    process.env.INPUT_FORMAT = 'json';

    const inputs = readActionInputs();
    expect(inputs.repoPath).toBe(repoRoot);
    expect(inputs.baseRef).toBe('base-sha-123');
    expect(inputs.headRef).toBe('head-sha-456');
    expect(inputs.format).toBe('json');
    expect(inputs.allowedWorkspaceRoot).toBe(repoRoot);
  });

  it('documents the metadata contract in action.yml', () => {
    const actionYaml = readFileSync(join(repoRoot, 'apps/github-action/action.yml'), 'utf8');
    const parsed = YAML.parse(actionYaml) as Record<string, unknown>;
    const inputs = parsed.inputs as Record<string, Record<string, unknown>>;
    const outputs = parsed.outputs as Record<string, Record<string, unknown>>;
    const runs = parsed.runs as Record<string, unknown>;

    expect(parsed.name).toBe('Dependency Risk Radar');
    expect(runs.using).toBe('node20');
    expect(runs.main).toBe('dist/index.js');
    expect(Object.keys(inputs).sort()).toEqual(['base', 'format', 'head', 'live-metadata', 'policy', 'repo']);
    expect(Object.keys(outputs).sort()).toEqual(['decision', 'exit-code-recommendation', 'json', 'markdown', 'score']);
  });
});

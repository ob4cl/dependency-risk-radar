import type { FinalAnalysisResult, NormalizedDependencyChange } from '@drr/shared';
import { MalformedInputError } from '@drr/shared';
import type { ParsedManifest } from './package-manifest';
import type { ParsedLockfile, LockfilePackageNode } from './lockfile';

export interface DependencySnapshot {
  manifest: ParsedManifest;
  lockfile: ParsedLockfile | null;
}

export interface DependencyDeltaInput {
  base: DependencySnapshot;
  head: DependencySnapshot;
}

function stableCompare(left: string, right: string): number {
  return left.localeCompare(right);
}

function normalizeVersion(version: string | null | undefined): string | null {
  if (!version) return null;
  const trimmed = version.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseNumericVersion(version: string | null): [number, number, number] | null {
  if (!version) return null;
  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareVersions(left: string | null, right: string | null): number | null {
  const a = parseNumericVersion(left);
  const b = parseNumericVersion(right);
  if (!a || !b) return null;
  const [a0, a1, a2] = a;
  const [b0, b1, b2] = b;
  if (a0 !== b0) return a0 < b0 ? -1 : 1;
  if (a1 !== b1) return a1 < b1 ? -1 : 1;
  if (a2 !== b2) return a2 < b2 ? -1 : 1;
  return 0;
}

function dependencyNames(manifest: ParsedManifest): Set<string> {
  return new Set(Object.keys(manifest.dependencies));
}

function dependencySpec(manifest: ParsedManifest, name: string): string | null {
  return manifest.dependencies[name] ?? null;
}

function findNodeByName(lockfile: ParsedLockfile, name: string): LockfilePackageNode | null {
  const candidates = Array.from(lockfile.packages.values()).filter((node) => node.name === name);
  if (candidates.length === 0) return null;
  candidates.sort((left, right) => stableCompare(left.id, right.id));
  return candidates[0] ?? null;
}

function rootDependencyVersion(lockfile: ParsedLockfile | null, name: string): string | null {
  if (!lockfile) return null;
  const direct = lockfile.rootDependencies[name];
  if (direct) return normalizeVersion(direct);
  const node = findNodeByName(lockfile, name);
  return node ? normalizeVersion(node.version) : null;
}

function countReachablePackages(lockfile: ParsedLockfile, node: LockfilePackageNode, seen = new Set<string>()): number {
  if (seen.has(node.id)) return 0;
  seen.add(node.id);
  let total = 1;
  for (const depName of node.dependencies) {
    const child = findNodeByName(lockfile, depName);
    if (child && !seen.has(child.id)) {
      total += countReachablePackages(lockfile, child, seen);
    }
  }
  return total;
}

function transitiveCount(lockfile: ParsedLockfile | null, name: string): number | null {
  if (!lockfile) return null;
  const node = findNodeByName(lockfile, name);
  if (!node) return null;
  return countReachablePackages(lockfile, node);
}

function packageMetadata(lockfile: ParsedLockfile | null, name: string) {
  const node = lockfile ? findNodeByName(lockfile, name) : null;
  const metadata: NonNullable<NormalizedDependencyChange['metadata']> = {};
  if (node?.hasInstallScript) metadata.hasInstallScript = true;
  if (node?.nativeBuild) metadata.nativeBuild = true;
  if (node?.repository) metadata.repository = node.repository;
  if (node?.license) metadata.license = node.license;
  return metadata;
}

function determineChangeType(baseSpec: string | null, headSpec: string | null, baseVersion: string | null, headVersion: string | null): NormalizedDependencyChange['changeType'] {
  if (!baseSpec && headSpec) return 'added';
  if (baseSpec && !headSpec) return 'removed';
  if (baseSpec === headSpec && baseVersion === headVersion) return 'unchanged';
  if (baseSpec === headSpec) return 'lockfile-only';
  const comparison = compareVersions(baseVersion, headVersion);
  if (comparison === null) return 'lockfile-only';
  return comparison < 0 ? 'upgraded' : comparison > 0 ? 'downgraded' : 'lockfile-only';
}

function buildChange(name: string, input: DependencyDeltaInput): NormalizedDependencyChange | null {
  const baseSpec = dependencySpec(input.base.manifest, name);
  const headSpec = dependencySpec(input.head.manifest, name);
  const baseVersion = rootDependencyVersion(input.base.lockfile, name);
  const headVersion = rootDependencyVersion(input.head.lockfile, name);
  if (!baseSpec && !headSpec && !baseVersion && !headVersion) {
    return null;
  }

  const changeType = determineChangeType(baseSpec, headSpec, baseVersion, headVersion);
  const baseCount = transitiveCount(input.base.lockfile, name);
  const headCount = transitiveCount(input.head.lockfile, name);
  const delta = baseCount !== null && headCount !== null ? headCount - baseCount : undefined;
  const metadata = {
    ...packageMetadata(input.base.lockfile, name),
    ...packageMetadata(input.head.lockfile, name),
  };

  const change: NormalizedDependencyChange = {
    ecosystem: input.head.manifest.ecosystem,
    name,
    changeType,
    fromVersion: baseVersion ?? baseSpec,
    toVersion: headVersion ?? headSpec,
    direct: true,
    manifestPath: input.head.manifest.path,
    lockfilePath: input.head.lockfile?.path ?? input.base.lockfile?.path ?? null,
    workspace: input.head.manifest.name ?? input.base.manifest.name ?? null,
    metadata,
  };

  if (typeof delta === 'number') {
    change.transitiveCountDelta = delta;
  }

  return change;
}

export function generateDependencyDelta(input: DependencyDeltaInput): NormalizedDependencyChange[] {
  const names = new Set<string>([...Object.keys(input.base.manifest.dependencies), ...Object.keys(input.head.manifest.dependencies)]);
  const changes = Array.from(names)
    .sort(stableCompare)
    .map((name) => buildChange(name, input))
    .filter((value): value is NormalizedDependencyChange => value !== null);

  if (changes.length === 0 && !input.base.lockfile && !input.head.lockfile) {
    throw new MalformedInputError('No dependency data available to compare', {});
  }

  return changes;
}

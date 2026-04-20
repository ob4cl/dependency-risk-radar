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

function packageNodesByName(lockfile: ParsedLockfile, name: string): LockfilePackageNode[] {
  return Array.from(lockfile.packages.values()).filter((node) => node.name === name);
}

function chooseNode(nodes: LockfilePackageNode[], parentId?: string, dependencyVersion?: string | null): LockfilePackageNode | null {
  if (nodes.length === 0) {
    return null;
  }

  const expectedVersion = normalizeVersion(dependencyVersion);
  if (expectedVersion) {
    const versionMatches = nodes.filter((node) => normalizeVersion(node.version) === expectedVersion);
    if (versionMatches.length === 1) {
      return versionMatches[0] ?? null;
    }
    if (versionMatches.length > 1) {
      versionMatches.sort((left, right) => stableCompare(left.id, right.id));
      return versionMatches[0] ?? null;
    }
  }

  if (parentId) {
    const exactPathMatches = nodes.filter((node) => node.id.startsWith(`${parentId}/node_modules/`));
    if (exactPathMatches.length > 0) {
      exactPathMatches.sort((left, right) => stableCompare(left.id, right.id));
      return exactPathMatches[0] ?? null;
    }
  }

  const rootMatches = nodes.filter((node) => node.id.startsWith('node_modules/'));
  if (rootMatches.length > 0) {
    rootMatches.sort((left, right) => stableCompare(left.id, right.id));
    return rootMatches[0] ?? null;
  }

  const sorted = [...nodes].sort((left, right) => stableCompare(left.id, right.id));
  return sorted[0] ?? null;
}

function resolveNode(lockfile: ParsedLockfile, name: string, dependencyVersion?: string | null, parentId?: string): LockfilePackageNode | null {
  const exactIds = parentId ? [`${parentId}/node_modules/${name}`, `node_modules/${name}`] : [`node_modules/${name}`];
  for (const id of exactIds) {
    const exact = lockfile.packages.get(id);
    if (exact && exact.name === name) {
      if (!dependencyVersion || normalizeVersion(exact.version) === normalizeVersion(dependencyVersion)) {
        return exact;
      }
    }
  }

  return chooseNode(packageNodesByName(lockfile, name), parentId, dependencyVersion);
}

function rootDependencyVersion(lockfile: ParsedLockfile | null, name: string): string | null {
  if (!lockfile) return null;
  const direct = lockfile.rootDependencies[name];
  if (direct) return normalizeVersion(direct);
  const node = resolveNode(lockfile, name, undefined);
  return node ? normalizeVersion(node.version) : null;
}

function countReachablePackages(lockfile: ParsedLockfile, node: LockfilePackageNode): number {
  const seen = new Set<string>();
  const stack: LockfilePackageNode[] = [node];
  let total = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || seen.has(current.id)) {
      continue;
    }

    seen.add(current.id);
    total += 1;

    for (const [depName, depVersion] of Object.entries(current.dependencies)) {
      const child = resolveNode(lockfile, depName, depVersion, current.id);
      if (child && !seen.has(child.id)) {
        stack.push(child);
      }
    }
  }

  return total;
}

function transitiveCount(lockfile: ParsedLockfile | null, name: string, version?: string | null): number | null {
  if (!lockfile) return null;
  const node = resolveNode(lockfile, name, version);
  if (!node) return null;
  return countReachablePackages(lockfile, node);
}

function packageMetadata(lockfile: ParsedLockfile | null, name: string, version?: string | null) {
  const node = lockfile ? resolveNode(lockfile, name, version) : null;
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
  const baseCount = transitiveCount(input.base.lockfile, name, baseVersion);
  const headCount = transitiveCount(input.head.lockfile, name, headVersion);
  const delta = baseCount !== null && headCount !== null ? headCount - baseCount : undefined;
  const metadata = {
    ...packageMetadata(input.base.lockfile, name, baseVersion),
    ...packageMetadata(input.head.lockfile, name, headVersion),
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

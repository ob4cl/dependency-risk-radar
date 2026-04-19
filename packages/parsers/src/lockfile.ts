import { parse as parseYaml } from 'yaml';
import { MalformedInputError } from '@drr/shared';

export type LockfileKind = 'package-lock' | 'pnpm-lock';

export interface LockfilePackageNode {
  id: string;
  name: string;
  version: string;
  dependencies: string[];
  hasInstallScript: boolean;
  nativeBuild: boolean;
  license: string | null;
  repository: string | null;
}

export interface ParsedLockfile {
  kind: LockfileKind;
  path: string;
  rootDependencies: Record<string, string>;
  packages: Map<string, LockfilePackageNode>;
  importers: Map<string, Record<string, string>>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function toStringMap(value: unknown): Record<string, string> {
  const record = asRecord(value);
  if (!record) return {};

  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(record)) {
    if (typeof raw === 'string') {
      result[key] = raw;
      continue;
    }
    const candidate = asRecord(raw);
    if (!candidate) continue;
    const version = candidate['version'];
    const specifier = candidate['specifier'];
    if (typeof version === 'string') {
      result[key] = version;
    } else if (typeof specifier === 'string') {
      result[key] = specifier;
    }
  }
  return result;
}

function toDependenciesList(value: unknown): string[] {
  return Object.keys(toStringMap(value));
}

function parsePackageLock(text: string, path: string): ParsedLockfile {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch (error) {
    throw new MalformedInputError(`Invalid package-lock.json at ${path}`, {
      path,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const packages = new Map<string, LockfilePackageNode>();
  const packageEntries = asRecord(data['packages']) ?? {};
  const rootEntry = asRecord(packageEntries['']) ?? undefined;
  const rootDependencies = toStringMap(rootEntry?.['dependencies'] ?? data['dependencies']);

  for (const [id, raw] of Object.entries(packageEntries)) {
    if (id === '') continue;
    const entry = asRecord(raw);
    if (!entry) continue;

    const pathParts = id.split('/').filter(Boolean);
    const name = typeof entry['name'] === 'string' ? entry['name'] : pathParts[pathParts.length - 1] ?? id;
    const version = typeof entry['version'] === 'string' ? entry['version'] : '0.0.0';
    packages.set(id, {
      id,
      name,
      version,
      dependencies: toDependenciesList(entry['dependencies']),
      hasInstallScript: Boolean(entry['hasInstallScript']),
      nativeBuild: Boolean(entry['gypfile']) || Boolean(entry['hasInstallScript']),
      license: typeof entry['license'] === 'string' ? entry['license'] : null,
      repository: typeof entry['repository'] === 'string' ? entry['repository'] : null,
    });
  }

  return {
    kind: 'package-lock',
    path,
    rootDependencies,
    packages,
    importers: new Map([[ '.', rootDependencies ]]),
  };
}

function parsePnpmLock(text: string, path: string): ParsedLockfile {
  let data: Record<string, unknown>;
  try {
    data = parseYaml(text) as Record<string, unknown>;
  } catch (error) {
    throw new MalformedInputError(`Invalid pnpm-lock.yaml at ${path}`, {
      path,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const importers = new Map<string, Record<string, string>>();
  const packages = new Map<string, LockfilePackageNode>();
  const importerSection = asRecord(data['importers']) ?? {};

  for (const [importerPath, raw] of Object.entries(importerSection)) {
    const entry = asRecord(raw);
    if (!entry) continue;
    importers.set(importerPath, {
      ...toStringMap(entry['dependencies']),
      ...toStringMap(entry['devDependencies']),
      ...toStringMap(entry['optionalDependencies']),
    });
  }

  const packagesSection = asRecord(data['packages']) ?? {};
  for (const [id, raw] of Object.entries(packagesSection)) {
    const entry = asRecord(raw);
    if (!entry) continue;

    const normalized = id.startsWith('/') ? id.slice(1) : id;
    const atIndex = normalized.lastIndexOf('@');
    const name = atIndex > 0 ? normalized.slice(0, atIndex) : normalized;
    const version = atIndex > 0 ? normalized.slice(atIndex + 1) : '0.0.0';
    packages.set(id, {
      id,
      name,
      version,
      dependencies: toDependenciesList(entry['dependencies']),
      hasInstallScript: Boolean(entry['hasInstallScript']),
      nativeBuild: Boolean(entry['hasBin']) || Boolean(entry['hasInstallScript']),
      license: typeof entry['license'] === 'string' ? entry['license'] : null,
      repository: typeof entry['repository'] === 'string' ? entry['repository'] : null,
    });
  }

  const rootDependencies = importers.get('.') ?? {};
  return { kind: 'pnpm-lock', path, rootDependencies, packages, importers };
}

export function parseLockfile(text: string, path: string): ParsedLockfile {
  if (path.endsWith('package-lock.json')) return parsePackageLock(text, path);
  if (path.endsWith('pnpm-lock.yaml')) return parsePnpmLock(text, path);
  throw new MalformedInputError(`Unsupported lockfile path: ${path}`, { path });
}

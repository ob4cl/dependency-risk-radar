import { z } from 'zod';
import type { Ecosystem } from '@drr/shared';
import { MalformedInputError, UnsupportedEcosystemError } from '@drr/shared';

const dependencyGroupSchema = z.record(z.string(), z.string()).optional().default({});

const packageJsonSchema = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
  packageManager: z.string().optional(),
  workspaces: z.union([z.array(z.string()), z.object({ packages: z.array(z.string()) })]).optional(),
  dependencies: dependencyGroupSchema,
  devDependencies: dependencyGroupSchema,
  optionalDependencies: dependencyGroupSchema,
  peerDependencies: dependencyGroupSchema,
  repository: z.union([z.string(), z.object({ url: z.string().optional() })]).optional(),
  license: z.string().optional(),
  homepage: z.string().optional(),
  description: z.string().optional(),
});

export interface ParsedManifest {
  ecosystem: Ecosystem;
  path: string;
  name: string | null;
  version: string | null;
  packageManager: string | null;
  dependencies: Record<string, string>;
  dependencyGroups: {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    optionalDependencies: Record<string, string>;
    peerDependencies: Record<string, string>;
  };
  metadata: {
    license: string | null;
    repository: string | null;
    homepage: string | null;
    description: string | null;
    workspaces: string[];
  };
}

function parseWorkspaces(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (value && typeof value === 'object') {
    const packages = (value as { packages?: unknown }).packages;
    if (Array.isArray(packages)) {
      return packages.filter((item): item is string => typeof item === 'string');
    }
  }
  return [];
}

function parseRepository(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const url = (value as { url?: unknown }).url;
    return typeof url === 'string' ? url : null;
  }
  return null;
}

export function parsePackageJson(text: string, path: string): ParsedManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new MalformedInputError(`Invalid package.json at ${path}`, { path, error: error instanceof Error ? error.message : String(error) });
  }

  const parsed = packageJsonSchema.safeParse(raw);
  if (!parsed.success) {
    throw new MalformedInputError(`Invalid package.json at ${path}`, { issues: parsed.error.issues, path });
  }

  return {
    ecosystem: 'npm',
    path,
    name: parsed.data.name ?? null,
    version: parsed.data.version ?? null,
    packageManager: parsed.data.packageManager ?? null,
    dependencies: {
      ...parsed.data.dependencies,
      ...parsed.data.devDependencies,
      ...parsed.data.optionalDependencies,
      ...parsed.data.peerDependencies,
    },
    dependencyGroups: {
      dependencies: parsed.data.dependencies,
      devDependencies: parsed.data.devDependencies,
      optionalDependencies: parsed.data.optionalDependencies,
      peerDependencies: parsed.data.peerDependencies,
    },
    metadata: {
      license: parsed.data.license ?? null,
      repository: parseRepository(parsed.data.repository),
      homepage: parsed.data.homepage ?? null,
      description: parsed.data.description ?? null,
      workspaces: parseWorkspaces(parsed.data.workspaces),
    },
  };
}

export function inferEcosystemFromPackageManager(packageManager: string | undefined): Ecosystem {
  if (packageManager?.startsWith('pnpm')) {
    return 'pnpm';
  }
  if (packageManager?.startsWith('npm') || packageManager?.startsWith('node')) {
    return 'npm';
  }
  throw new UnsupportedEcosystemError(packageManager ?? 'unknown');
}

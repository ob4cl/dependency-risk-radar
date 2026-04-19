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
  dependencies: Record<string, string>;
  metadata: {
    license: string | null;
    repository: string | null;
    homepage: string | null;
    description: string | null;
    workspaces: string[];
  };
}

export function parsePackageJson(text: string, path: string): ParsedManifest {
  const parsed = packageJsonSchema.safeParse(JSON.parse(text));
  if (!parsed.success) {
    throw new MalformedInputError(`Invalid package.json at ${path}`, { issues: parsed.error.issues });
  }

  const repo = typeof parsed.data.repository === 'string'
    ? parsed.data.repository
    : parsed.data.repository?.url ?? null;

  const workspaces = Array.isArray(parsed.data.workspaces)
    ? parsed.data.workspaces
    : parsed.data.workspaces?.packages ?? [];

  return {
    ecosystem: 'npm',
    path,
    name: parsed.data.name ?? null,
    version: parsed.data.version ?? null,
    dependencies: {
      ...parsed.data.dependencies,
      ...parsed.data.devDependencies,
      ...parsed.data.optionalDependencies,
      ...parsed.data.peerDependencies,
    },
    metadata: {
      license: parsed.data.license ?? null,
      repository: repo,
      homepage: parsed.data.homepage ?? null,
      description: parsed.data.description ?? null,
      workspaces,
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

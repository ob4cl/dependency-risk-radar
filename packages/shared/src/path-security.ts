import { realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { DependencyRiskRadarError } from './errors';

export interface PathValidationContext {
  kind: string;
  path: string;
  allowedRoots: readonly string[];
}

export class PathNotFoundError extends DependencyRiskRadarError {
  constructor(path: string, details?: Record<string, unknown>) {
    super(`Path not found: ${path}`, 'PATH_NOT_FOUND', details ?? { path });
  }
}

export class PathOutsideAllowedRootError extends DependencyRiskRadarError {
  constructor(path: string, details?: Record<string, unknown>) {
    super(`Path is outside the allowed workspace root: ${path}`, 'PATH_OUTSIDE_ALLOWED_ROOT', details ?? { path });
  }
}

export class SymlinkEscapeError extends DependencyRiskRadarError {
  constructor(path: string, details?: Record<string, unknown>) {
    super(`Path resolves outside the allowed root via symlink: ${path}`, 'SYMLINK_ESCAPE', details ?? { path });
  }
}

export class PathUnreadableError extends DependencyRiskRadarError {
  constructor(path: string, details?: Record<string, unknown>) {
    super(`Path is unreadable: ${path}`, 'PATH_UNREADABLE', details ?? { path });
  }
}

function normalizeRoot(root: string): string {
  return resolve(root);
}

function rootRealpath(root: string): string {
  try {
    const resolved = realpathSync(root);
    return resolved;
  } catch (error) {
    throw new PathNotFoundError(root, { error: error instanceof Error ? error.message : String(error) });
  }
}

function isWithinRoot(candidate: string, root: string): boolean {
  const candidateRelative = relative(root, candidate);
  return candidateRelative === '' || (!candidateRelative.startsWith('..') && !isAbsolute(candidateRelative));
}

export function resolvePathWithinRoots(context: PathValidationContext): string {
  const rawPath = resolve(context.path);
  const roots = context.allowedRoots.map(normalizeRoot);
  if (roots.length === 0) {
    throw new PathOutsideAllowedRootError(context.path, { kind: context.kind, allowedRoots: roots });
  }

  const rawAllowedRoot = roots.find((root) => isWithinRoot(rawPath, root));
  if (!rawAllowedRoot) {
    throw new PathOutsideAllowedRootError(context.path, { kind: context.kind, path: rawPath, allowedRoots: roots });
  }

  let realPath: string;
  try {
    realPath = realpathSync(rawPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
      throw new PathNotFoundError(context.path, { kind: context.kind, path: rawPath });
    }
    throw new PathUnreadableError(context.path, { kind: context.kind, error: error instanceof Error ? error.message : String(error) });
  }

  const allowedRoot = roots.find((root) => isWithinRoot(realPath, root));
  if (!allowedRoot) {
    throw new SymlinkEscapeError(context.path, { kind: context.kind, path: rawPath, resolvedPath: realPath, allowedRoots: roots });
  }

  return realPath;
}

export function assertDirectoryWithinRoots(context: PathValidationContext): string {
  const path = resolvePathWithinRoots(context);
  try {
    if (!statSync(path).isDirectory()) {
      throw new PathUnreadableError(context.path, { kind: context.kind, path });
    }
  } catch (error) {
    if (error instanceof PathUnreadableError) throw error;
    throw new PathUnreadableError(context.path, { kind: context.kind, error: error instanceof Error ? error.message : String(error) });
  }
  return path;
}

export function assertFileWithinRoots(context: PathValidationContext): string {
  const path = resolvePathWithinRoots(context);
  try {
    if (!statSync(path).isFile()) {
      throw new PathUnreadableError(context.path, { kind: context.kind, path });
    }
  } catch (error) {
    if (error instanceof PathUnreadableError) throw error;
    throw new PathUnreadableError(context.path, { kind: context.kind, error: error instanceof Error ? error.message : String(error) });
  }
  return path;
}

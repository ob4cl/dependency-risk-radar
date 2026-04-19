export function fetchJson(url: string, init: RequestInit = {}, timeoutMs = 5_000): Promise<unknown | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal })
    .then(async (response) => {
      if (!response.ok) return null;
      return response.json();
    })
    .catch(() => null)
    .finally(() => {
      clearTimeout(timeout);
    });
}

export function normalizeRepositoryUrl(repository: unknown): string | null {
  if (typeof repository === 'string') return repository;
  if (repository && typeof repository === 'object') {
    const url = (repository as { url?: unknown }).url;
    return typeof url === 'string' ? url : null;
  }
  return null;
}

export function parseGitHubSlug(repository: string | null): { owner: string; repo: string } | null {
  if (!repository) return null;
  const httpsMatch = repository.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/)?$/i);
  if (httpsMatch) {
    return { owner: httpsMatch[1]!, repo: httpsMatch[2]! };
  }
  const sshMatch = repository.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (sshMatch) {
    return { owner: sshMatch[1]!, repo: sshMatch[2]! };
  }
  return null;
}

export function stableUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export class MemoryCache<T> {
  private readonly entries = new Map<string, { expiresAt: number; value: T }>();

  constructor(private readonly ttlMs = 60_000) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs = this.ttlMs): void {
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  clear(): void {
    this.entries.clear();
  }
}

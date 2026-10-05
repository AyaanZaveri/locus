/** Small, short-lived cache for repeat palette queries; never cache errors. */
export class CommandSearchCache<T> {
  private entries = new Map<string, { value: T; expiresAt: number }>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly ttl = 60_000,
    private readonly capacity = 50,
  ) {}

  get(query: string): T | undefined {
    const entry = this.entries.get(query);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(query);
      return undefined;
    }
    return entry.value;
  }

  set(query: string, value: T) {
    this.entries.delete(query);
    this.entries.set(query, { value, expiresAt: this.now() + this.ttl });
    if (this.entries.size > this.capacity) {
      this.entries.delete(this.entries.keys().next().value!);
    }
  }
}

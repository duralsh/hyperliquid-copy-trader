export class TTLCache<T> {
  private entry: { data: T; fetchedAt: number } | null = null;
  constructor(private ttl: number) {}
  get(): T | null {
    if (this.entry && Date.now() - this.entry.fetchedAt < this.ttl) return this.entry.data;
    return null;
  }
  set(data: T): void { this.entry = { data, fetchedAt: Date.now() }; }
  invalidate(): void { this.entry = null; }
}

export class TTLMapCache<K, V> {
  private map = new Map<K, { data: V; fetchedAt: number }>();
  constructor(private ttl: number) {}
  get(key: K): V | null {
    const entry = this.map.get(key);
    if (entry && Date.now() - entry.fetchedAt < this.ttl) return entry.data;
    return null;
  }
  set(key: K, data: V): void { this.map.set(key, { data, fetchedAt: Date.now() }); }
  invalidate(key: K): void { this.map.delete(key); }
}

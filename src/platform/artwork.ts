import { useEffect, useSyncExternalStore } from 'react';

/**
 * Pictures (album covers, film posters) are made on first use by the native module and cached in the app's private folder. This keeps
 * the answers in memory, so a list of covers renders instantly and each picture is requested once.
 */
class ArtCache {
  private readonly values = new Map<string, string | null>();
  private readonly pending = new Set<string>();
  private readonly waiting: (() => void)[] = [];
  private running = 0;
  private readonly listeners = new Set<() => void>();
  private version = 0;

  get = (key: string): string | null | undefined => this.values.get(key);

  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  snapshot = (): number => this.version;

  /** Starts making a picture unless it is known or already being made. At most three are made at once. */
  request(key: string, make: () => Promise<string | null>): void {
    if (this.values.has(key) || this.pending.has(key)) return;
    this.pending.add(key);
    const run = (): void => {
      this.running += 1;
      make().catch(() => null).then((uri) => {
        this.values.set(key, uri);
        this.pending.delete(key);
        this.running -= 1;
        this.version += 1;
        for (const listener of this.listeners) listener();
        this.waiting.shift()?.();
      });
    };
    if (this.running < 3) run(); else this.waiting.push(run);
  }

  forget(prefix: string): void {
    for (const key of this.values.keys()) if (key.startsWith(prefix)) this.values.delete(key);
    this.version += 1;
    for (const listener of this.listeners) listener();
  }
}

export const art = new ArtCache();

/** The picture for `key` (null when there is none, undefined while it is being made). `make` is only called when needed. */
export function useArt(key: string | null, make: (() => Promise<string | null>) | null): string | null | undefined {
  useSyncExternalStore(art.subscribe, art.snapshot);
  useEffect(() => {
    if (key !== null && make !== null) art.request(key, make);
  }, [key, make]);
  return key === null ? null : art.get(key);
}

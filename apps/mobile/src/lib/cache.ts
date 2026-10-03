import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Tiny stale-while-revalidate cache for Supabase reads.
 *
 * - Sync in-memory map for instant renders.
 * - AsyncStorage backing for offline-first restarts (per key opt-in).
 * - Request deduplication so concurrent mounts share one network call.
 * - Offline fallback: a failed fetch resolves with stale data when available.
 */

const PREFIX = 'isla-cache-v1:';

type Entry<T> = {
  value: T;
  expiresAt: number;
  savedAt: number;
};

const memory = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export const CACHE_TTLS = {
  merchants: 10 * 60 * 1000,
  merchant: 10 * 60 * 1000,
  products: 5 * 60 * 1000,
  orders: 30 * 1000,
  orderDetail: 30 * 1000,
  conversations: 20 * 1000,
  messages: 30 * 1000,
  notifications: 30 * 1000,
  unreadCount: 20 * 1000,
} as const;

export function cacheKey(...parts: Array<string | number | null | undefined | false>): string {
  return parts.filter((p) => p !== null && p !== undefined && p !== false).join(':');
}

function storageKey(key: string): string {
  return `${PREFIX}${key}`;
}

function isFresh<T>(entry: Entry<T> | undefined, now = Date.now()): entry is Entry<T> {
  return !!entry && entry.expiresAt > now;
}

export function peekEntry<T>(key: string): { value: T; fresh: boolean } | null {
  const entry = memory.get(key) as Entry<T> | undefined;
  if (!entry) return null;
  return { value: entry.value, fresh: isFresh(entry) };
}

export function setEntry<T>(key: string, value: T, ttlMs: number, persist = true): void {
  const now = Date.now();
  const entry: Entry<T> = { value, expiresAt: now + ttlMs, savedAt: now };
  memory.set(key, entry as Entry<unknown>);
  if (persist) {
    void AsyncStorage.setItem(storageKey(key), JSON.stringify(entry)).catch(() => undefined);
  }
}

export async function readPersistedEntry<T>(key: string): Promise<{ value: T; fresh: boolean } | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(key));
    if (!raw) return null;
    const entry = JSON.parse(raw) as Entry<T>;
    if (!entry || typeof entry.expiresAt !== 'number') return null;
    // Warm memory so the next sync peek hits (keeps original expiry).
    const remaining = entry.expiresAt - Date.now();
    if (remaining > 0) {
      memory.set(key, entry as Entry<unknown>);
      return { value: entry.value, fresh: true };
    }
    return { value: entry.value, fresh: false };
  } catch {
    return null;
  }
}

export type FetchWithCacheOptions = {
  ttlMs: number;
  persist?: boolean;
  /** Force network even when memory has fresh data. */
  force?: boolean;
};

/**
 * Single-flight cached fetch. Returns fresh data when possible, stale data
 * when offline, and throws only when there is nothing cached to fall back to.
 */
export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts: FetchWithCacheOptions,
): Promise<T> {
  const persist = opts.persist ?? true;
  const now = Date.now();
  const mem = memory.get(key) as Entry<T> | undefined;
  if (!opts.force && mem && mem.expiresAt > now) return mem.value;

  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;

  const task = (async (): Promise<T> => {
    try {
      const value = await fetcher();
      setEntry(key, value, opts.ttlMs, persist);
      return value;
    } catch (err) {
      // Offline fallback: prefer memory, then persisted, else rethrow.
      if (mem) return mem.value;
      if (persist) {
        const stored = await readPersistedEntry<T>(key);
        if (stored) {
          memory.set(key, {
            value: stored.value,
            expiresAt: Date.now() + opts.ttlMs,
            savedAt: Date.now(),
          } as Entry<unknown>);
          return stored.value;
        }
      }
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, task as Promise<unknown>);
  return task;
}

export function invalidate(key: string): void {
  memory.delete(key);
  inflight.delete(key);
  void AsyncStorage.removeItem(storageKey(key)).catch(() => undefined);
}

export function invalidatePrefix(prefix: string): void {
  for (const key of [...memory.keys()]) {
    if (key === prefix || key.startsWith(prefix)) {
      memory.delete(key);
      inflight.delete(key);
    }
  }
  void (async () => {
    try {
      const all = await AsyncStorage.getAllKeys();
      const ours = all.filter(
        (k) => k === storageKey(prefix) || k.startsWith(`${storageKey(prefix)}`),
      );
      // Prefix match on the logical key: storage keys share the PREFIX.
      const byLogical = all.filter((k) => {
        if (!k.startsWith(PREFIX)) return false;
        const logical = k.slice(PREFIX.length);
        return logical === prefix || logical.startsWith(prefix);
      });
      const targets = [...new Set([...ours, ...byLogical])];
      if (targets.length > 0) await AsyncStorage.multiRemove(targets);
    } catch {
      // Best-effort only.
    }
  })();
}

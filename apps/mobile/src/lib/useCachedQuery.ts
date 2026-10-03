import { useCallback, useEffect, useRef, useState } from 'react';
import {
  peekEntry,
  readPersistedEntry,
  fetchWithCache,
  setEntry,
} from './cache';

export type UseCachedQueryOptions = {
  ttlMs: number;
  persist?: boolean;
  enabled?: boolean;
};

export type UseCachedQueryResult<T> = {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  setData: (value: T) => void;
};

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error('Could not load data.');
}

/**
 * Stale-while-revalidate query hook.
 * - Sync memory peek renders instantly.
 * - Persisted cache hydrates after mount for offline-first.
 * - Fresh entries skip the network; stale/missing entries revalidate.
 */
export function useCachedQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  opts: UseCachedQueryOptions,
): UseCachedQueryResult<T> {
  const persist = opts.persist ?? true;
  const enabled = opts.enabled ?? true;
  const [data, setDataState] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const keyRef = useRef(key);
  keyRef.current = key;

  const setData = useCallback(
    (value: T) => {
      const k = keyRef.current;
      setDataState(value);
      setError(null);
      if (k) setEntry(k, value, opts.ttlMs, persist);
    },
    [opts.ttlMs, persist],
  );

  useEffect(() => {
    if (!key || !enabled) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    let cancelled = false;

    const peeked = peekEntry<T>(key);
    if (peeked) {
      setDataState(peeked.value);
      setError(null);
      setLoading(false);
      if (peeked.fresh) {
        // Fresh cache: no network needed.
        return () => {
          cancelled = true;
        };
      }
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    let hydrated = !!peeked;

    void (async () => {
      try {
        if (!peeked && persist) {
          const stored = await readPersistedEntry<T>(key);
          if (cancelled) return;
          if (stored) {
            setDataState(stored.value);
            hydrated = true;
            if (stored.fresh) {
              setLoading(false);
              return;
            }
            setLoading(false);
            setRefreshing(true);
          }
        } else if (peeked) {
          setLoading(false);
        }

        const value = await fetchWithCache(key, () => fetcherRef.current(), {
          ttlMs: opts.ttlMs,
          persist,
        });
        if (cancelled) return;
        setDataState(value);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        // Keep stale data on screen when offline; only error when empty.
        if (!hydrated) setError(toError(err));
        else setError(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key, enabled, opts.ttlMs, persist]);

  const refresh = useCallback(async () => {
    const k = keyRef.current;
    if (!k) return;
    setRefreshing(true);
    setError(null);
    try {
      const value = await fetchWithCache(k, () => fetcherRef.current(), {
        ttlMs: opts.ttlMs,
        persist,
        force: true,
      });
      setDataState(value);
    } catch (err) {
      setError((prev) => prev ?? toError(err));
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [opts.ttlMs, persist]);

  return { data, loading, refreshing, error, refresh, setData };
}

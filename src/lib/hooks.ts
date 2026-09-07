import { useEffect, useRef } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { api, type ListParams } from './api';
import type { CollectionMap, CollectionName } from '../domain/types';

export function collectionKey(collection: CollectionName, params: ListParams = {}) {
  return [collection, params.month ?? null, params.from ?? null, params.to ?? null] as const;
}

export function useCollection<K extends CollectionName>(
  collection: K,
  params: ListParams = {},
): UseQueryResult<CollectionMap[K][]> {
  return useQuery({
    queryKey: collectionKey(collection, params),
    queryFn: () => api.list(collection, params),
  });
}

/** Every cached window of a collection, for optimistic edits and invalidation. */
function matchingQueries(collection: CollectionName) {
  return { queryKey: [collection], exact: false } as const;
}

export function useCreate<K extends CollectionName>(collection: K) {
  const client = useQueryClient();

  return useMutation<CollectionMap[K], Error, Partial<CollectionMap[K]>>({
    mutationKey: ['create'],
    mutationFn: (data) => api.create(collection, data),
    onSettled: () => client.invalidateQueries(matchingQueries(collection)),
  });
}

/**
 * Optimistic by design. Ticking an item off must feel instant and must survive
 * being offline, so the cache is updated first and the server call is allowed
 * to catch up — or to sit in the queue until there's signal again.
 */
export function useUpdate<K extends CollectionName>(collection: K, params: ListParams = {}) {
  const client = useQueryClient();

  return useMutation<
    CollectionMap[K],
    Error,
    { id: string; patch: Partial<CollectionMap[K]> },
    { previous: Array<[readonly unknown[], unknown]> }
  >({
    mutationKey: ['update'],
    mutationFn: ({ id, patch }) => api.update(collection, id, patch, params),

    onMutate: async ({ id, patch }) => {
      await client.cancelQueries(matchingQueries(collection));
      const previous = client.getQueriesData(matchingQueries(collection));

      client.setQueriesData<CollectionMap[K][]>(matchingQueries(collection), (list) =>
        list?.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );

      return { previous };
    },

    onError: (_error, _vars, context) => {
      context?.previous.forEach(([key, data]) => client.setQueryData(key, data));
    },

    onSettled: () => client.invalidateQueries(matchingQueries(collection)),
  });
}

export function useRemove<K extends CollectionName>(collection: K, params: ListParams = {}) {
  const client = useQueryClient();

  return useMutation<
    { ok: boolean },
    Error,
    string,
    { previous: Array<[readonly unknown[], unknown]> }
  >({
    mutationKey: ['remove'],
    mutationFn: (id) => api.remove(collection, id, params),

    onMutate: async (id) => {
      await client.cancelQueries(matchingQueries(collection));
      const previous = client.getQueriesData(matchingQueries(collection));

      client.setQueriesData<CollectionMap[K][]>(matchingQueries(collection), (list) =>
        list?.filter((item) => item.id !== id),
      );

      return { previous };
    },

    onError: (_error, _id, context) => {
      context?.previous.forEach(([key, data]) => client.setQueryData(key, data));
    },

    onSettled: () => client.invalidateQueries(matchingQueries(collection)),
  });
}

/**
 * Keeps both phones in step without a realtime channel: poll one small
 * endpoint of per-collection timestamps and refetch only what actually moved.
 * Backs right off when the app is hidden, since a backgrounded PWA polling
 * every few seconds is just battery drain.
 */
export function useChangePolling(activeMs = 10_000, hiddenMs = 120_000): void {
  const client = useQueryClient();
  const seen = useRef<Record<string, string>>({});

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const tick = async () => {
      try {
        const cursors = await api.changes();
        for (const [collection, updatedAt] of Object.entries(cursors)) {
          if (seen.current[collection] !== updatedAt) {
            seen.current[collection] = updatedAt;
            client.invalidateQueries({ queryKey: [collection], exact: false });
          }
        }
      } catch {
        // Offline or a hiccup: the next tick tries again.
      }
      if (!cancelled) {
        timer = setTimeout(tick, document.hidden ? hiddenMs : activeMs);
      }
    };

    // A first pass populates the baseline without invalidating anything the
    // page just fetched.
    timer = setTimeout(tick, activeMs);

    const onVisible = () => {
      if (!document.hidden) {
        clearTimeout(timer);
        void tick();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [client, activeMs, hiddenMs]);
}

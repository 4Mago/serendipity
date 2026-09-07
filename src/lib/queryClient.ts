import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { del, get, set } from 'idb-keyval';
import { api, type ListParams } from './api';
import type { CollectionName } from '../domain/types';

export interface CreateVars {
  collection: CollectionName;
  data: Record<string, unknown>;
}
export interface UpdateVars {
  collection: CollectionName;
  id: string;
  patch: Record<string, unknown>;
  params?: ListParams;
}
export interface RemoveVars {
  collection: CollectionName;
  id: string;
  params?: ListParams;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 'offlineFirst' serves the persisted cache immediately instead of
      // sitting in a pending state with no network — the difference between a
      // usable and a useless shopping list in a supermarket basement.
      networkMode: 'offlineFirst',
      // Cursor polling drives freshness, so background refetching on every
      // focus would just duplicate work.
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24 * 7,
      refetchOnWindowFocus: false,
      retry: 2,
    },
    mutations: {
      networkMode: 'offlineFirst',
      retry: 3,
    },
  },
});

/**
 * Persisted mutations are restored without their function, so every mutation
 * the app can queue offline must have its implementation registered by key.
 * Without these defaults a queued tick would replay into a no-op.
 */
queryClient.setMutationDefaults(['create'], {
  mutationFn: (vars: CreateVars) => api.create(vars.collection, vars.data),
});
queryClient.setMutationDefaults(['update'], {
  mutationFn: (vars: UpdateVars) => api.update(vars.collection, vars.id, vars.patch, vars.params),
});
queryClient.setMutationDefaults(['remove'], {
  mutationFn: (vars: RemoveVars) => api.remove(vars.collection, vars.id, vars.params),
});

export const persister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => get<string>(key).then((value) => value ?? null),
    setItem: (key, value) => set(key, value),
    removeItem: (key) => del(key),
  },
  key: 'hemma-query-cache',
  throttleTime: 1000,
});

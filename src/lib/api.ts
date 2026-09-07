import type { CollectionMap, CollectionName } from '../domain/types';
import { getToken } from './identity';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface ListParams {
  month?: string;
  from?: string;
  to?: string;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const response = await fetch(path, { ...init, headers });

  if (!response.ok) {
    const message = await response
      .json()
      .then((body: { error?: string }) => body.error ?? response.statusText)
      .catch(() => response.statusText);
    throw new ApiError(response.status, message);
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

function query(params: ListParams): string {
  const search = new URLSearchParams();
  if (params.month) search.set('month', params.month);
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}

export const api = {
  list: <K extends CollectionName>(collection: K, params: ListParams = {}) =>
    request<CollectionMap[K][]>(`/api/${collection}${query(params)}`),

  create: <K extends CollectionName>(collection: K, data: Partial<CollectionMap[K]>) =>
    request<CollectionMap[K]>(`/api/${collection}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: <K extends CollectionName>(
    collection: K,
    id: string,
    patch: Partial<CollectionMap[K]>,
    params: ListParams = {},
  ) =>
    request<CollectionMap[K]>(`/api/${collection}/${id}${query(params)}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),

  remove: (collection: CollectionName, id: string, params: ListParams = {}) =>
    request<{ ok: boolean }>(`/api/${collection}/${id}${query(params)}`, { method: 'DELETE' }),

  changes: () => request<Record<string, string>>('/api/changes'),

  generateShopping: (from: string, to: string) =>
    request<{ created: CollectionMap['shopping'][]; mealsConsidered: number }>(
      '/api/generate-shopping',
      { method: 'POST', body: JSON.stringify({ from, to }) },
    ),

  upload: async (file: File) => {
    const token = await getToken();
    const headers = new Headers({ 'content-type': file.type });
    if (token) headers.set('authorization', `Bearer ${token}`);

    const response = await fetch('/api/uploads', { method: 'POST', headers, body: file });
    if (!response.ok) throw new ApiError(response.status, 'Upload failed');
    return (await response.json()) as { id: string; url: string };
  },
};

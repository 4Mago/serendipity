import { getStore, type Store } from '@netlify/blobs';
import { COLLECTIONS } from '../../src/domain/collections';
import { isValidMonthKey, monthKey, monthsInRange } from '../../src/domain/dates';
import type { BaseRecord, CollectionName } from '../../src/domain/types';
import { assertValidId, HttpError } from './http';

export type StoredRecord = BaseRecord & Record<string, unknown>;

/** Blobs read/write concurrency. High enough to be fast, low enough to be polite. */
const CONCURRENCY = 25;

function storeFor(collection: CollectionName): Store {
  const config = COLLECTIONS[collection];
  return getStore({
    name: collection,
    consistency: config.strongConsistency ? 'strong' : 'eventual',
  });
}

/** Cursors are polled constantly, so a stale read would defeat their purpose. */
function cursorStore(): Store {
  return getStore({ name: 'cursors', consistency: 'strong' });
}

function shardOf(collection: CollectionName, record: Record<string, unknown>): string | null {
  const config = COLLECTIONS[collection];
  if (!config.monthSharded) return null;

  const raw = record[config.dateField ?? 'date'];
  if (typeof raw !== 'string') {
    throw new HttpError(400, `${collection} requires a "${config.dateField}" date field`);
  }
  return monthKey(raw);
}

function keyFor(collection: CollectionName, record: StoredRecord): string {
  const shard = shardOf(collection, record);
  const id = assertValidId(record.id);
  return shard ? `${shard}/${id}` : id;
}

/** Runs `task` over `items` with a bounded number in flight. */
async function mapLimit<T, R>(items: T[], task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await task(items[index]);
    }
  });

  await Promise.all(workers);
  return results;
}

export interface ListOptions {
  /** Single month shard, `YYYY-MM`. */
  month?: string;
  /** Inclusive date range; expanded to every shard it touches. */
  from?: string;
  to?: string;
}

/**
 * Reads a whole collection (or the requested month shards) and returns it as
 * one array. This is a `list()` plus N parallel `get()`s — the cost of having
 * no query engine. Month sharding is what keeps N small as history grows.
 */
export async function listRecords(
  collection: CollectionName,
  options: ListOptions = {},
): Promise<StoredRecord[]> {
  const store = storeFor(collection);
  const prefixes = resolvePrefixes(collection, options);

  const keyGroups = await Promise.all(
    prefixes.map(async (prefix) => {
      const { blobs } = await store.list(prefix ? { prefix } : {});
      return blobs.map((blob) => blob.key);
    }),
  );

  const keys = keyGroups.flat();
  const records = await mapLimit(keys, (key) => store.get(key, { type: 'json' }));

  // A key can vanish between list and get; skip rather than fail the request.
  return records.filter((record): record is StoredRecord => record !== null);
}

function resolvePrefixes(collection: CollectionName, options: ListOptions): (string | null)[] {
  if (!COLLECTIONS[collection].monthSharded) return [null];

  if (options.month) {
    if (!isValidMonthKey(options.month)) throw new HttpError(400, 'Invalid month');
    return [`${options.month}/`];
  }

  if (options.from && options.to) {
    const months = monthsInRange(options.from, options.to);
    if (months.length === 0) throw new HttpError(400, 'Invalid date range');
    return months.map((month) => `${month}/`);
  }

  // No window given: read every shard. Correct, and fine at two-person volumes.
  return [null];
}

export async function getRecord(
  collection: CollectionName,
  id: string,
  month?: string,
): Promise<StoredRecord | null> {
  const store = storeFor(collection);
  assertValidId(id);

  if (!COLLECTIONS[collection].monthSharded) {
    return store.get(id, { type: 'json' });
  }

  if (month) {
    if (!isValidMonthKey(month)) throw new HttpError(400, 'Invalid month');
    return store.get(`${month}/${id}`, { type: 'json' });
  }

  // Without a month hint the shard is unknown, so fall back to a scan.
  const { blobs } = await store.list({});
  const match = blobs.find((blob) => blob.key.endsWith(`/${id}`));
  return match ? store.get(match.key, { type: 'json' }) : null;
}

export async function createRecord(
  collection: CollectionName,
  data: Record<string, unknown>,
): Promise<StoredRecord> {
  const now = new Date().toISOString();
  const record: StoredRecord = {
    ...data,
    id: typeof data.id === 'string' ? assertValidId(data.id) : crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };

  await storeFor(collection).setJSON(keyFor(collection, record), record);
  await bumpCursor(collection);
  return record;
}

/**
 * Read-modify-write on a single blob. Two people editing the *same* record at
 * the same instant still resolves last-write-wins — Blobs offers no compare-
 * and-swap. Sharding per entity is what keeps that from mattering: edits to
 * different items never touch the same blob.
 */
export async function updateRecord(
  collection: CollectionName,
  id: string,
  patch: Record<string, unknown>,
  month?: string,
): Promise<StoredRecord> {
  const store = storeFor(collection);
  const existing = await getRecord(collection, id, month);
  if (!existing) throw new HttpError(404, `${collection}/${id} not found`);

  const updated: StoredRecord = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  const oldKey = keyFor(collection, existing);
  const newKey = keyFor(collection, updated);

  await store.setJSON(newKey, updated);
  // Editing the date of a sharded record moves it to another shard; the old
  // copy has to go or the record would appear twice.
  if (oldKey !== newKey) await store.delete(oldKey);

  await bumpCursor(collection);
  return updated;
}

export async function deleteRecord(
  collection: CollectionName,
  id: string,
  month?: string,
): Promise<boolean> {
  const existing = await getRecord(collection, id, month);
  if (!existing) return false;

  await storeFor(collection).delete(keyFor(collection, existing));
  await bumpCursor(collection);
  return true;
}

/** Writes several records concurrently, then bumps the cursor once. */
export async function createMany(
  collection: CollectionName,
  items: Record<string, unknown>[],
): Promise<StoredRecord[]> {
  const store = storeFor(collection);
  const now = new Date().toISOString();

  const records: StoredRecord[] = items.map((data) => ({
    ...data,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  }));

  await mapLimit(records, (record) => store.setJSON(keyFor(collection, record), record));
  if (records.length > 0) await bumpCursor(collection);
  return records;
}

/**
 * Polling support. Each mutation stamps its collection, so the client can ask
 * one cheap question — "what changed?" — instead of refetching everything.
 * Last-write-wins on a timestamp is harmless: the worst case is a redundant
 * refetch, never a lost record.
 */
export async function bumpCursor(collection: CollectionName): Promise<void> {
  await cursorStore().setJSON(collection, { updatedAt: new Date().toISOString() });
}

export async function readCursors(): Promise<Record<string, string>> {
  const store = cursorStore();
  const { blobs } = await store.list({});

  const entries = await mapLimit(blobs, async (blob) => {
    const value = await store.get(blob.key, { type: 'json' });
    const updatedAt = (value as { updatedAt?: string } | null)?.updatedAt;
    return [blob.key, updatedAt ?? ''] as const;
  });

  return Object.fromEntries(entries.filter(([, updatedAt]) => updatedAt !== ''));
}

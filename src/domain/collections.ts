import type { CollectionName } from './types';

export interface CollectionConfig {
  /**
   * Month-sharded collections use keys of the form `YYYY-MM/<id>` so a typical
   * query lists one narrow prefix instead of walking all history. Applied to
   * collections that grow without bound.
   */
  monthSharded: boolean;
  /**
   * Netlify Blobs defaults to eventual consistency, which propagates within
   * ~60s. That is far too slow for anything two people look at simultaneously,
   * so live collections opt into strong consistency and accept slower reads.
   */
  strongConsistency: boolean;
  /** Which field a month-sharded record derives its shard from. */
  dateField?: string;
}

export const COLLECTIONS: Record<CollectionName, CollectionConfig> = {
  // Tiny, read constantly, changes almost never.
  profiles: { monthSharded: false, strongConsistency: true },

  // The most contended screen in the app — both phones open in a supermarket.
  shopping: { monthSharded: false, strongConsistency: true },

  // Written by one person at a time; a minute of staleness is harmless.
  recipes: { monthSharded: false, strongConsistency: false },

  // The centrepiece. Edited collaboratively while planning the week.
  meals: { monthSharded: true, strongConsistency: true, dateField: 'date' },

  // Logged on the spot, often right after a shop.
  expenses: { monthSharded: true, strongConsistency: true, dateField: 'spentAt' },

  categories: { monthSharded: false, strongConsistency: false },
  apartment: { monthSharded: false, strongConsistency: false },
  errands: { monthSharded: false, strongConsistency: true },
  events: { monthSharded: true, strongConsistency: true, dateField: 'start' },
};

export const COLLECTION_NAMES = Object.keys(COLLECTIONS) as CollectionName[];

export function isCollection(value: string): value is CollectionName {
  return Object.prototype.hasOwnProperty.call(COLLECTIONS, value);
}

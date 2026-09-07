import type { Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { isCollection } from '../../src/domain/collections';
import { buildShoppingList, excludeExisting } from '../../src/domain/shopping';
import type { MealEntry, Recipe, ShoppingItem } from '../../src/domain/types';
import { requireUser, type AuthedUser } from '../lib/auth';
import { assertValidId, error, HttpError, json, readJsonBody } from '../lib/http';
import {
  createMany,
  createRecord,
  deleteRecord,
  getRecord,
  listRecords,
  readCursors,
  updateRecord,
} from '../lib/store';

/** Netlify Functions cap request payloads at ~6 MB; stay clear of the edge. */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export default async (request: Request): Promise<Response> => {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const segments = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);

    // Literal routes are matched before the generic collection routes, so a
    // collection can never shadow them.
    if (segments[0] === 'changes') return await handleChanges(request);
    if (segments[0] === 'generate-shopping') return await handleGenerateShopping(request, user);
    if (segments[0] === 'uploads') return await handleUploads(request, segments[1]);

    return await handleCollection(request, url, segments, user);
  } catch (caught) {
    if (caught instanceof HttpError) return error(caught.status, caught.message);
    console.error('Unhandled API error', caught);
    return error(500, 'Internal error');
  }
};

async function handleChanges(request: Request): Promise<Response> {
  if (request.method !== 'GET') return error(405, 'Method not allowed');
  // Polled every few seconds — must never be cached anywhere.
  return json(await readCursors(), 200, { 'cache-control': 'no-store' });
}

async function handleCollection(
  request: Request,
  url: URL,
  segments: string[],
  user: AuthedUser,
): Promise<Response> {
  const [name, id] = segments;
  if (!name || !isCollection(name)) return error(404, 'Unknown collection');
  if (segments.length > 2) return error(404, 'Not found');

  const month = url.searchParams.get('month') ?? undefined;

  if (!id) {
    switch (request.method) {
      case 'GET':
        return json(
          await listRecords(name, {
            month,
            from: url.searchParams.get('from') ?? undefined,
            to: url.searchParams.get('to') ?? undefined,
          }),
          200,
          { 'cache-control': 'no-store' },
        );
      case 'POST':
        return json(await createRecord(name, stamp(await readJsonBody(request), user)), 201);
      default:
        return error(405, 'Method not allowed');
    }
  }

  assertValidId(id);

  switch (request.method) {
    case 'GET': {
      const record = await getRecord(name, id, month);
      return record ? json(record) : error(404, 'Not found');
    }
    case 'PUT':
    case 'PATCH':
      return json(await updateRecord(name, id, await readJsonBody(request), month));
    case 'DELETE': {
      const removed = await deleteRecord(name, id, month);
      return removed ? json({ ok: true }) : error(404, 'Not found');
    }
    default:
      return error(405, 'Method not allowed');
  }
}

/** Records who made a change, so the UI can show it. Carries no permissions. */
function stamp(body: Record<string, unknown>, user: AuthedUser): Record<string, unknown> {
  return { ...body, addedBy: body.addedBy ?? user.id };
}

/**
 * Turns a window of the meal plan into shopping items: scale each recipe by the
 * servings planned, merge equivalent ingredients, drop anything already waiting
 * on the list, and write the remainder.
 */
async function handleGenerateShopping(request: Request, user: AuthedUser): Promise<Response> {
  if (request.method !== 'POST') return error(405, 'Method not allowed');

  const body = await readJsonBody(request);
  const from = body.from;
  const to = body.to;
  if (typeof from !== 'string' || typeof to !== 'string') {
    throw new HttpError(400, 'from and to are required (YYYY-MM-DD)');
  }
  if (from > to) throw new HttpError(400, 'from must not be after to');

  const [mealRecords, recipeRecords, existingRecords] = await Promise.all([
    listRecords('meals', { from, to }),
    listRecords('recipes'),
    listRecords('shopping'),
  ]);

  // Month shards are coarser than the requested window, so trim to the dates asked for.
  const meals = (mealRecords as unknown as MealEntry[]).filter(
    (entry) => entry.date >= from && entry.date <= to,
  );

  const drafts = excludeExisting(
    buildShoppingList(meals, recipeRecords as unknown as Recipe[]),
    existingRecords as unknown as ShoppingItem[],
  );

  const created = await createMany(
    'shopping',
    drafts.map((draft) => ({ ...draft, isChecked: false, addedBy: user.id })),
  );

  return json({ created, skipped: 0, mealsConsidered: meals.length }, 201);
}

/**
 * Recipe and receipt images. Stored in their own blob store keyed by UUID;
 * reads are authenticated like everything else, and cached hard by the service
 * worker since an upload is immutable once written.
 */
async function handleUploads(request: Request, id?: string): Promise<Response> {
  const store = getStore({ name: 'uploads', consistency: 'eventual' });

  if (request.method === 'POST') {
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) throw new HttpError(400, 'Only images are accepted');

    const bytes = await request.arrayBuffer();
    if (bytes.byteLength === 0) throw new HttpError(400, 'Empty upload');
    if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new HttpError(413, 'Image is too large (max 5 MB)');

    const uploadId = crypto.randomUUID();
    await store.set(uploadId, bytes, { metadata: { contentType } });
    return json({ id: uploadId, url: `/api/uploads/${uploadId}` }, 201);
  }

  if (request.method === 'GET') {
    if (!id) return error(400, 'Missing upload id');
    assertValidId(id);

    const result = await store.getWithMetadata(id, { type: 'arrayBuffer' });
    if (!result) return error(404, 'Not found');

    const contentType = (result.metadata?.contentType as string) ?? 'application/octet-stream';
    return new Response(result.data, {
      headers: {
        'content-type': contentType,
        // Immutable content under a UUID key, so cache aggressively and keep
        // repeat views off the function budget.
        'cache-control': 'private, max-age=31536000, immutable',
      },
    });
  }

  return error(405, 'Method not allowed');
}

export const config: Config = { path: '/api/*' };

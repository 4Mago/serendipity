/** Small helpers so every route returns consistently shaped JSON. */

export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

export function error(status: number, message: string): Response {
  return json({ error: message }, status);
}

/** Thrown by route handlers to short-circuit with a specific status. */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Keys are used directly as blob paths, so anything exotic is rejected. */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function assertValidId(id: string): string {
  if (!ID_PATTERN.test(id)) throw new HttpError(400, `Invalid id: ${id}`);
  return id;
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    throw new HttpError(400, 'Body must be valid JSON');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new HttpError(400, 'Body must be a JSON object');
  }
  return parsed as Record<string, unknown>;
}

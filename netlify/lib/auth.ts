import { HOUSEHOLD } from '../../src/domain/household';

export interface RecordAuthor {
  id: string;
}

/**
 * Reads which of the two household members claims to be making the request.
 *
 * This is deliberately NOT authentication. The header is client-supplied and
 * unverified; it exists only so records can show who added them. Every route
 * is currently open to anyone who can reach it.
 *
 * If this app is ever deployed somewhere reachable, put a real gate here —
 * a shared passphrase checked against an environment variable is the smallest
 * thing that would do, and every route already funnels through this function.
 */
export function readAuthor(request: Request): RecordAuthor {
  const claimed = request.headers.get('x-hemma-person') ?? '';
  const known = HOUSEHOLD.some((person) => person.id === claimed);
  return { id: known ? claimed : 'unknown' };
}

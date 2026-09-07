import { getUser } from '@netlify/identity';
import { HttpError } from './http';

export interface AuthedUser {
  id: string;
  email?: string;
  displayName?: string;
}

/**
 * Every /api route runs through this. Identity is configured invite-only, so
 * possessing a valid session is the whole authorisation model — there are only
 * ever two accounts, and everything in the site's blob stores belongs to both
 * of them. That is why there is no per-row ownership check anywhere below.
 *
 * `getUser()` reads the JWT from the ambient request context rather than a
 * parameter, and resolves it against the Identity API — so this costs one
 * round trip per request, falling back to the JWT's own claims if Identity is
 * unreachable.
 */
export async function requireUser(): Promise<AuthedUser> {
  const user = await getUser();
  if (!user) throw new HttpError(401, 'Not signed in');

  return { id: user.id, email: user.email, displayName: user.name };
}

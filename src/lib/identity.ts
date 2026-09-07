import netlifyIdentity, { type User } from 'netlify-identity-widget';

let initialised = false;

export function initIdentity(): void {
  if (initialised) return;
  netlifyIdentity.init({ locale: 'en' });
  initialised = true;
}

export function currentUser(): User | null {
  return netlifyIdentity.currentUser();
}

/**
 * A fresh JWT for the API. `jwt()` refreshes automatically when the token is
 * close to expiring, which matters here: an installed PWA can sit backgrounded
 * for days between shops.
 */
export async function getToken(): Promise<string | null> {
  const user = netlifyIdentity.currentUser();
  if (!user) return null;
  try {
    return await user.jwt();
  } catch {
    return null;
  }
}

export function openLogin(): void {
  netlifyIdentity.open('login');
}

export function logout(): void {
  netlifyIdentity.logout();
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  const onLogin = (user: User) => {
    netlifyIdentity.close();
    callback(user);
  };
  const onLogout = () => callback(null);
  const onInit = (user: User | null) => callback(user);

  netlifyIdentity.on('login', onLogin);
  netlifyIdentity.on('logout', onLogout);
  netlifyIdentity.on('init', onInit);

  return () => {
    netlifyIdentity.off('login', onLogin);
    netlifyIdentity.off('logout', onLogout);
    netlifyIdentity.off('init', onInit);
  };
}

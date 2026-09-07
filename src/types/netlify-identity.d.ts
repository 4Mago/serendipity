/**
 * `netlify-identity-widget` wraps gotrue-js, whose User exposes `jwt()` for
 * fetching a current (auto-refreshing) access token. The published @types
 * package omits it, so declare it here rather than casting at every call site.
 */
declare module 'netlify-identity-widget' {
  interface User {
    jwt(forceRefresh?: boolean): Promise<string>;
  }
}

export {};

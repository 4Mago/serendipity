import { registerSW } from 'virtual:pwa-register';

/**
 * Registers the service worker and hands back a callback that applies a
 * waiting update. Deliberately not auto-updating: reloading the app while
 * someone is halfway through a shop is worse than a small prompt.
 */
export function setupServiceWorker(onUpdateAvailable: (apply: () => void) => void): void {
  const updateSW = registerSW({
    onNeedRefresh: () => onUpdateAvailable(() => void updateSW(true)),
  });
}

import { HOUSEHOLD, type Person } from '../domain/household';

/**
 * Which of the two people is using this device.
 *
 * This is NOT authentication. It is stored in localStorage, chosen by whoever
 * opens the app, and trivially changed — it exists so the interface can say
 * who added a meal or ticked an item, nothing more. Any real access control
 * has to happen server-side.
 */

const KEY = 'hemma-whoami';

export function getWhoami(): Person | null {
  try {
    const id = localStorage.getItem(KEY);
    return HOUSEHOLD.find((person) => person.id === id) ?? null;
  } catch {
    // Private mode or blocked storage: fall back to asking again.
    return null;
  }
}

export function setWhoami(person: Person): void {
  try {
    localStorage.setItem(KEY, person.id);
  } catch {
    // Not fatal — the choice just won't survive a reload.
  }
}

export function clearWhoami(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

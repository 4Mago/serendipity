/**
 * The household is fixed at two people. Without accounts there is nothing to
 * look identity up from, so each device records who is using it locally — this
 * is a display preference, never a permission check.
 */

export interface Person {
  id: string;
  name: string;
  /** One of the produce accents, used consistently wherever the person appears. */
  colour: string;
}

export const HOUSEHOLD: Person[] = [
  { id: 'marcus', name: 'Marcus', colour: 'var(--hav)' },
  { id: 'clara', name: 'Clara', colour: 'var(--lok)' },
];

export function personById(id: string | undefined): Person | undefined {
  return HOUSEHOLD.find((person) => person.id === id);
}

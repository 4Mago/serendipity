/**
 * The household is fixed at two people. Without accounts there is nothing to
 * look identity up from, so each device records who is using it locally — this
 * is a display preference, never a permission check.
 */

export interface Person {
  id: string;
  name: string;
  /**
   * One of the validated chart hues, so the two are distinguishable under
   * every colour-vision deficiency. Always shown alongside the initial, so
   * colour is never the only cue.
   */
  colour: string;
}

export const HOUSEHOLD: Person[] = [
  { id: 'marcus', name: 'Marcus', colour: 'var(--chart-2)' },
  { id: 'clara', name: 'Clara', colour: 'var(--chart-1)' },
];

export function personById(id: string | undefined): Person | undefined {
  return HOUSEHOLD.find((person) => person.id === id);
}

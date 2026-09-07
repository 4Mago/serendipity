/**
 * Unit normalisation for ingredient merging.
 *
 * When a week of meals is turned into one shopping list, the same ingredient
 * arrives spelled and measured inconsistently across recipes — "500 g" from one
 * and "0,5 kg" from another. Without normalisation the list shows both, which
 * defeats the point of generating it. Swedish cooking units (msk, tsk, krm, st)
 * are first-class here since the recipes will be written in Swedish.
 */

export type UnitFamily = 'mass' | 'volume' | 'count';

interface UnitDef {
  family: UnitFamily;
  /** How many base units (g for mass, ml for volume, 1 for count). */
  factor: number;
  canonical: string;
}

const UNITS: Record<string, UnitDef> = {
  // Mass — base gram
  g: { family: 'mass', factor: 1, canonical: 'g' },
  gram: { family: 'mass', factor: 1, canonical: 'g' },
  hg: { family: 'mass', factor: 100, canonical: 'hg' },
  kg: { family: 'mass', factor: 1000, canonical: 'kg' },
  kilo: { family: 'mass', factor: 1000, canonical: 'kg' },

  // Volume — base millilitre
  ml: { family: 'volume', factor: 1, canonical: 'ml' },
  krm: { family: 'volume', factor: 1, canonical: 'krm' },
  tsk: { family: 'volume', factor: 5, canonical: 'tsk' },
  msk: { family: 'volume', factor: 15, canonical: 'msk' },
  cl: { family: 'volume', factor: 10, canonical: 'cl' },
  dl: { family: 'volume', factor: 100, canonical: 'dl' },
  l: { family: 'volume', factor: 1000, canonical: 'l' },
  liter: { family: 'volume', factor: 1000, canonical: 'l' },

  // Count — base piece
  st: { family: 'count', factor: 1, canonical: 'st' },
  styck: { family: 'count', factor: 1, canonical: 'st' },
  stk: { family: 'count', factor: 1, canonical: 'st' },
  förp: { family: 'count', factor: 1, canonical: 'förp' },
  pkt: { family: 'count', factor: 1, canonical: 'förp' },
  klyfta: { family: 'count', factor: 1, canonical: 'klyfta' },
  klyftor: { family: 'count', factor: 1, canonical: 'klyfta' },
  näve: { family: 'count', factor: 1, canonical: 'näve' },
};

/** Units to render a merged total in, largest first, per family. */
const PREFERRED: Record<UnitFamily, string[]> = {
  mass: ['kg', 'g'],
  volume: ['l', 'dl', 'ml'],
  count: [],
};

/**
 * Spoon and pinch measures are recipe units, not shopping units. Rewriting
 * "2 tsk" as "10 ml" is technically correct and practically useless, so these
 * are left alone whenever they are the only unit a total was built from. They
 * still convert when they must be summed with a different unit.
 */
const NON_PROMOTABLE = new Set(['tsk', 'msk', 'krm']);

export function isPromotable(unit: string | null): boolean {
  const def = lookupUnit(unit);
  return def ? !NON_PROMOTABLE.has(def.canonical) : false;
}

export function lookupUnit(unit: string | null): UnitDef | null {
  if (!unit) return null;
  const key = unit.trim().toLowerCase().replace(/\.$/, '');
  return UNITS[key] ?? null;
}

export function unitFamily(unit: string | null): UnitFamily | null {
  return lookupUnit(unit)?.family ?? null;
}

/** Converts a quantity to its family's base unit. Null if the unit is unknown. */
export function toBase(quantity: number, unit: string | null): number | null {
  const def = lookupUnit(unit);
  return def ? quantity * def.factor : null;
}

/**
 * Renders a base-unit quantity in the most readable unit of its family:
 * 1500 g becomes "1,5 kg" rather than "1500 g". Count units keep whatever unit
 * they came in as, since "3 klyfta" must not become "3 st".
 */
export function fromBase(
  baseQuantity: number,
  family: UnitFamily,
  fallbackUnit: string,
): { quantity: number; unit: string } {
  for (const candidate of PREFERRED[family]) {
    const def = UNITS[candidate];
    if (def && baseQuantity >= def.factor) {
      return { quantity: round(baseQuantity / def.factor), unit: candidate };
    }
  }
  const def = lookupUnit(fallbackUnit);
  return def
    ? { quantity: round(baseQuantity / def.factor), unit: def.canonical }
    : { quantity: round(baseQuantity), unit: fallbackUnit };
}

/** Two decimals is plenty for a shopping list, and avoids float dust. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Normalises an ingredient name for merge comparison: case, whitespace and a
 * trailing parenthetical note are ignored, so "Lök" and "lök (gul)" merge.
 */
export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Formats a quantity the Swedish way: 1.5 -> "1,5", 2 -> "2". */
export function formatQuantity(quantity: number): string {
  return new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 }).format(quantity);
}

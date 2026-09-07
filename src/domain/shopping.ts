import type { Category, Ingredient, MealEntry, Recipe, ShoppingItem } from './types';
import { CATEGORY_ORDER } from './types';
import { fromBase, isPromotable, lookupUnit, normaliseName, toBase, unitFamily } from './units';

export interface DraftShoppingItem {
  name: string;
  quantity: number | null;
  unit: string | null;
  category: Category;
  sourceRecipeId?: string;
  sourceRecipeTitle?: string;
  sourceMealDates: string[];
}

interface Group {
  displayName: string;
  normalised: string;
  category: Category;
  /** Total in the family's base unit. Null for unquantified entries. */
  baseTotal: number | null;
  family: ReturnType<typeof unitFamily>;
  fallbackUnit: string | null;
  /** Canonical units this total was built from, to decide how to render it. */
  unitsUsed: Set<string>;
  recipeIds: Set<string>;
  recipeTitles: Set<string>;
  dates: Set<string>;
}

/**
 * Turns a set of planned meals into a merged shopping list.
 *
 * Each recipe's ingredients are scaled by how many servings were actually
 * planned, then ingredients that are the same thing measured the same way are
 * summed — "500 g tomater" from Monday and "0,5 kg tomater" from Thursday
 * become one "1 kg tomater" line, tagged with both days.
 */
export function buildShoppingList(entries: MealEntry[], recipes: Recipe[]): DraftShoppingItem[] {
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const groups = new Map<string, Group>();

  for (const entry of entries) {
    if (!entry.recipeId) continue; // "leftovers" and "takeaway" have nothing to buy
    const recipe = recipeById.get(entry.recipeId);
    if (!recipe) continue;

    // A recipe with servings of 0 or missing would produce Infinity; treat it
    // as unscaled rather than poisoning every quantity with NaN.
    const base = recipe.servings > 0 ? recipe.servings : entry.servings;
    const multiplier = base > 0 ? entry.servings / base : 1;

    for (const ingredient of recipe.ingredients) {
      addToGroups(groups, ingredient, multiplier, recipe, entry);
    }
  }

  absorbUnquantified(groups);

  return [...groups.values()].map(toDraft).sort(compareDrafts);
}

function addToGroups(
  groups: Map<string, Group>,
  ingredient: Ingredient,
  multiplier: number,
  recipe: Recipe,
  entry: MealEntry,
): void {
  const normalised = normaliseName(ingredient.name);
  if (!normalised) return;

  const family = unitFamily(ingredient.unit);
  const scaled = ingredient.quantity === null ? null : ingredient.quantity * multiplier;

  // Unquantified ingredients ("salt", "peppar") group on name alone. Known
  // units group by family so g and kg combine; unknown units group by the
  // literal string so we never invent a conversion we don't have.
  const bucket =
    scaled === null
      ? 'unquantified'
      : family ?? `raw:${(ingredient.unit ?? 'none').toLowerCase()}`;
  const key = `${normalised}|${bucket}`;

  let group = groups.get(key);
  if (!group) {
    group = {
      displayName: ingredient.name.trim(),
      normalised,
      category: ingredient.category,
      baseTotal: scaled === null ? null : 0,
      family,
      fallbackUnit: ingredient.unit,
      unitsUsed: new Set(),
      recipeIds: new Set(),
      recipeTitles: new Set(),
      dates: new Set(),
    };
    groups.set(key, group);
  }

  if (scaled !== null && group.baseTotal !== null) {
    const inBase = family ? toBase(scaled, ingredient.unit) : scaled;
    group.baseTotal += inBase ?? scaled;
    const canonical = lookupUnit(ingredient.unit)?.canonical;
    if (canonical) group.unitsUsed.add(canonical);
  }

  // A specific category beats the catch-all, whichever recipe supplied it.
  if (group.category === 'other' && ingredient.category !== 'other') {
    group.category = ingredient.category;
  }

  group.recipeIds.add(recipe.id);
  group.recipeTitles.add(recipe.title);
  group.dates.add(entry.date);
}

/**
 * If "salt" appears unquantified in one recipe and as "2 tsk" in another, the
 * measured line already covers it — keep one line, not two, but carry the
 * extra recipe across so provenance stays complete.
 */
function absorbUnquantified(groups: Map<string, Group>): void {
  const quantifiedByName = new Map<string, Group>();
  for (const [key, group] of groups) {
    if (!key.endsWith('|unquantified')) quantifiedByName.set(group.normalised, group);
  }

  for (const [key, group] of groups) {
    if (!key.endsWith('|unquantified')) continue;
    const target = quantifiedByName.get(group.normalised);
    if (!target) continue;
    group.recipeIds.forEach((id) => target.recipeIds.add(id));
    group.recipeTitles.forEach((title) => target.recipeTitles.add(title));
    group.dates.forEach((date) => target.dates.add(date));
    groups.delete(key);
  }
}

function toDraft(group: Group): DraftShoppingItem {
  let quantity: number | null = null;
  let unit: string | null = null;

  if (group.baseTotal !== null) {
    if (group.family) {
      // A total built from one spoon measure stays in that measure; anything
      // mixed has to be reconciled into a common unit.
      const only = group.unitsUsed.size === 1 ? [...group.unitsUsed][0] : null;
      const def = only && !isPromotable(only) ? lookupUnit(only) : null;

      if (def) {
        quantity = Math.round((group.baseTotal / def.factor) * 100) / 100;
        unit = def.canonical;
      } else {
        const rendered = fromBase(group.baseTotal, group.family, group.fallbackUnit ?? '');
        quantity = rendered.quantity;
        unit = rendered.unit;
      }
    } else {
      quantity = Math.round(group.baseTotal * 100) / 100;
      unit = group.fallbackUnit;
    }
  }

  const titles = [...group.recipeTitles];
  return {
    name: group.displayName,
    quantity,
    unit,
    category: group.category,
    sourceRecipeId: group.recipeIds.size === 1 ? [...group.recipeIds][0] : undefined,
    sourceRecipeTitle: titles.length === 1 ? titles[0] : titles.join(', '),
    sourceMealDates: [...group.dates].sort(),
  };
}

/** Aisle order first, then alphabetical within an aisle. */
function compareDrafts(a: DraftShoppingItem, b: DraftShoppingItem): number {
  const byAisle = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
  return byAisle !== 0 ? byAisle : a.name.localeCompare(b.name, 'sv');
}

/**
 * Filters out drafts already covered by the list, so regenerating after adding
 * one more dinner doesn't duplicate everything. Unchecked matches are treated
 * as still needed; checked ones are ignored, since a ticked item from last
 * week's shop shouldn't suppress this week's.
 */
export function excludeExisting(
  drafts: DraftShoppingItem[],
  existing: ShoppingItem[],
): DraftShoppingItem[] {
  const present = new Set(
    existing.filter((item) => !item.isChecked).map((item) => normaliseName(item.name)),
  );
  return drafts.filter((draft) => !present.has(normaliseName(draft.name)));
}

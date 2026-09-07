import { describe, expect, it } from 'vitest';
import { buildShoppingList, excludeExisting } from './shopping';
import type { Category, Ingredient, MealEntry, Recipe, ShoppingItem } from './types';

let seq = 0;
const stamps = () => ({ createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' });

function ing(
  name: string,
  quantity: number | null,
  unit: string | null,
  category: Category = 'other',
): Ingredient {
  return { name, quantity, unit, category };
}

function recipe(title: string, servings: number, ingredients: Ingredient[]): Recipe {
  return {
    id: `r${++seq}`,
    title,
    servings,
    steps: [],
    ingredients,
    tags: [],
    isFavourite: false,
    ...stamps(),
  };
}

function meal(date: string, recipeId: string, servings: number): MealEntry {
  return {
    id: `m${++seq}`,
    date,
    slot: 'dinner',
    recipeId,
    servings,
    isCooked: false,
    ...stamps(),
  };
}

describe('buildShoppingList', () => {
  it('merges the same ingredient across units in one family', () => {
    const a = recipe('Pasta', 4, [ing('Tomater', 500, 'g', 'produce')]);
    const b = recipe('Gryta', 4, [ing('tomater', 0.5, 'kg', 'produce')]);
    const list = buildShoppingList(
      [meal('2026-09-14', a.id, 4), meal('2026-09-16', b.id, 4)],
      [a, b],
    );

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ quantity: 1, unit: 'kg', category: 'produce' });
  });

  it('scales quantities by the servings actually planned', () => {
    const r = recipe('Soppa', 4, [ing('Morötter', 400, 'g', 'produce')]);
    const list = buildShoppingList([meal('2026-09-14', r.id, 2)], [r]);

    expect(list[0].quantity).toBe(200);
    expect(list[0].unit).toBe('g');
  });

  it('scales up as well as down', () => {
    const r = recipe('Soppa', 2, [ing('Grädde', 2, 'dl', 'dairy')]);
    const list = buildShoppingList([meal('2026-09-14', r.id, 6)], [r]);

    expect(list[0]).toMatchObject({ quantity: 6, unit: 'dl' });
  });

  it('promotes to a larger unit once the total warrants it', () => {
    const r = recipe('Bak', 1, [ing('Mjölk', 4, 'dl', 'dairy')]);
    const list = buildShoppingList(
      [meal('2026-09-14', r.id, 1), meal('2026-09-15', r.id, 2)],
      [r],
    );

    expect(list[0]).toMatchObject({ quantity: 1.2, unit: 'l' });
  });

  it('converts Swedish spoon measures into the volume family', () => {
    const a = recipe('A', 1, [ing('Olivolja', 2, 'msk', 'pantry')]);
    const b = recipe('B', 1, [ing('olivolja', 2, 'tsk', 'pantry')]);
    const list = buildShoppingList(
      [meal('2026-09-14', a.id, 1), meal('2026-09-15', b.id, 1)],
      [a, b],
    );

    // 2 msk (30 ml) + 2 tsk (10 ml) = 40 ml
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ quantity: 40, unit: 'ml' });
  });

  it('ignores entries with no recipe, such as leftovers or takeaway', () => {
    const r = recipe('Pasta', 2, [ing('Pasta', 200, 'g', 'pantry')]);
    const leftovers: MealEntry = {
      id: 'm-left',
      date: '2026-09-15',
      slot: 'dinner',
      customTitle: 'Rester',
      servings: 2,
      isCooked: false,
      ...stamps(),
    };

    const list = buildShoppingList([meal('2026-09-14', r.id, 2), leftovers], [r]);
    expect(list).toHaveLength(1);
    expect(list[0].quantity).toBe(200);
  });

  it('folds an unquantified mention into the measured line', () => {
    const a = recipe('A', 1, [ing('Salt', null, null, 'pantry')]);
    const b = recipe('B', 1, [ing('salt', 2, 'tsk', 'pantry')]);
    const list = buildShoppingList(
      [meal('2026-09-14', a.id, 1), meal('2026-09-15', b.id, 1)],
      [a, b],
    );

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ quantity: 2, unit: 'tsk' });
    expect(list[0].sourceMealDates).toEqual(['2026-09-14', '2026-09-15']);
  });

  it('keeps an unquantified ingredient when nothing measures it', () => {
    const r = recipe('A', 1, [ing('Svartpeppar', null, null, 'pantry')]);
    const list = buildShoppingList([meal('2026-09-14', r.id, 1)], [r]);

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ quantity: null, unit: null });
  });

  it('refuses to merge across incompatible unit families', () => {
    const a = recipe('A', 1, [ing('Ost', 200, 'g', 'dairy')]);
    const b = recipe('B', 1, [ing('ost', 2, 'st', 'dairy')]);
    const list = buildShoppingList(
      [meal('2026-09-14', a.id, 1), meal('2026-09-15', b.id, 1)],
      [a, b],
    );

    expect(list).toHaveLength(2);
  });

  it('does not invent conversions for unknown units', () => {
    const a = recipe('A', 1, [ing('Basilika', 1, 'kruka', 'produce')]);
    const b = recipe('B', 1, [ing('basilika', 2, 'kruka', 'produce')]);
    const c = recipe('C', 1, [ing('basilika', 1, 'knippe', 'produce')]);
    const list = buildShoppingList(
      [meal('2026-09-14', a.id, 1), meal('2026-09-15', b.id, 1), meal('2026-09-16', c.id, 1)],
      [a, b, c],
    );

    // Same unknown unit sums; a different unknown unit stays its own line.
    expect(list).toHaveLength(2);
    expect(list.find((i) => i.unit === 'kruka')?.quantity).toBe(3);
    expect(list.find((i) => i.unit === 'knippe')?.quantity).toBe(1);
  });

  it('ignores a parenthetical qualifier when matching names', () => {
    const a = recipe('A', 1, [ing('Lök (gul)', 1, 'st', 'produce')]);
    const b = recipe('B', 1, [ing('lök', 2, 'st', 'produce')]);
    const list = buildShoppingList(
      [meal('2026-09-14', a.id, 1), meal('2026-09-15', b.id, 1)],
      [a, b],
    );

    expect(list).toHaveLength(1);
    expect(list[0].quantity).toBe(3);
  });

  it('prefers a specific category over the catch-all', () => {
    const a = recipe('A', 1, [ing('Grädde', 1, 'dl', 'other')]);
    const b = recipe('B', 1, [ing('grädde', 1, 'dl', 'dairy')]);
    const list = buildShoppingList(
      [meal('2026-09-14', a.id, 1), meal('2026-09-15', b.id, 1)],
      [a, b],
    );

    expect(list[0].category).toBe('dairy');
  });

  it('records every day an ingredient is needed for', () => {
    const r = recipe('Pasta', 2, [ing('Pasta', 100, 'g', 'pantry')]);
    const list = buildShoppingList(
      [meal('2026-09-16', r.id, 2), meal('2026-09-14', r.id, 2)],
      [r],
    );

    expect(list[0].sourceMealDates).toEqual(['2026-09-14', '2026-09-16']);
    expect(list[0].sourceRecipeTitle).toBe('Pasta');
  });

  it('sorts by supermarket aisle, then alphabetically', () => {
    const r = recipe('Allt', 1, [
      ing('Diskmedel', 1, 'st', 'household'),
      ing('Äpple', 2, 'st', 'produce'),
      ing('Mjölk', 1, 'l', 'dairy'),
      ing('Banan', 3, 'st', 'produce'),
    ]);
    const list = buildShoppingList([meal('2026-09-14', r.id, 1)], [r]);

    expect(list.map((i) => i.name)).toEqual(['Banan', 'Äpple', 'Mjölk', 'Diskmedel']);
  });

  it('survives a recipe with zero servings instead of producing NaN', () => {
    const r = recipe('Trasig', 0, [ing('Mjöl', 100, 'g', 'pantry')]);
    const list = buildShoppingList([meal('2026-09-14', r.id, 4)], [r]);

    expect(list[0].quantity).toBe(100);
    expect(Number.isNaN(list[0].quantity)).toBe(false);
  });

  it('skips meals whose recipe has been deleted', () => {
    const r = recipe('Finns', 1, [ing('Salt', 1, 'tsk', 'pantry')]);
    const list = buildShoppingList(
      [meal('2026-09-14', r.id, 1), meal('2026-09-15', 'deleted-recipe', 1)],
      [r],
    );

    expect(list).toHaveLength(1);
  });

  it('returns nothing for an empty plan', () => {
    expect(buildShoppingList([], [])).toEqual([]);
  });
});

describe('excludeExisting', () => {
  const item = (name: string, isChecked: boolean): ShoppingItem => ({
    id: `s${++seq}`,
    name,
    quantity: 1,
    unit: 'st',
    category: 'other',
    isChecked,
    ...stamps(),
  });

  const drafts = [
    { name: 'Mjölk', quantity: 1, unit: 'l', category: 'dairy' as Category, sourceMealDates: [] },
    { name: 'Bröd', quantity: 1, unit: 'st', category: 'bakery' as Category, sourceMealDates: [] },
  ];

  it('drops drafts already waiting on the list', () => {
    const result = excludeExisting(drafts, [item('mjölk', false)]);
    expect(result.map((d) => d.name)).toEqual(['Bröd']);
  });

  it('keeps drafts whose match was already bought', () => {
    const result = excludeExisting(drafts, [item('Mjölk', true)]);
    expect(result).toHaveLength(2);
  });

  it('is a no-op against an empty list', () => {
    expect(excludeExisting(drafts, [])).toHaveLength(2);
  });
});

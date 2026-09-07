/**
 * Shared domain types. Imported by both the React client and the Netlify
 * functions, so this file must stay free of browser and Node APIs.
 */

/** Ingredient/shopping aisle. Drives grouping on the shopping screen. */
export type Category =
  | 'produce'
  | 'dairy'
  | 'meat'
  | 'fish'
  | 'frozen'
  | 'bakery'
  | 'pantry'
  | 'drinks'
  | 'household'
  | 'other';

export const CATEGORIES: Category[] = [
  'produce',
  'dairy',
  'meat',
  'fish',
  'frozen',
  'bakery',
  'pantry',
  'drinks',
  'household',
  'other',
];

/** Order items appear in on the shopping list — roughly supermarket walk order. */
export const CATEGORY_ORDER: Record<Category, number> = {
  produce: 0,
  bakery: 1,
  meat: 2,
  fish: 3,
  dairy: 4,
  frozen: 5,
  pantry: 6,
  drinks: 7,
  household: 8,
  other: 9,
};

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export type EventType = 'gym' | 'travel' | 'social' | 'appointment' | 'other';

export type ApartmentStatus = 'idea' | 'agreed' | 'ordered' | 'bought';

/** Every stored record carries these. */
export interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** Who created it. Recorded for display only; it grants no permissions. */
  addedBy?: string;
}

export interface Profile extends BaseRecord {
  displayName: string;
  colour: string;
}

export interface Ingredient {
  name: string;
  /** null means "to taste" / unquantified — these never merge numerically. */
  quantity: number | null;
  unit: string | null;
  category: Category;
  note?: string;
}

export interface Recipe extends BaseRecord {
  title: string;
  description?: string;
  servings: number;
  prepMinutes?: number;
  cookMinutes?: number;
  steps: string[];
  ingredients: Ingredient[];
  imageId?: string;
  sourceUrl?: string;
  tags: string[];
  isFavourite: boolean;
  createdBy?: string;
}

export interface ShoppingItem extends BaseRecord {
  name: string;
  quantity: number | null;
  unit: string | null;
  category: Category;
  isChecked: boolean;
  checkedBy?: string;
  /** Set when generated from the meal plan, so the UI can show provenance. */
  sourceRecipeId?: string;
  sourceRecipeTitle?: string;
  sourceMealDates?: string[];
  note?: string;
}

export interface MealEntry extends BaseRecord {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  slot: MealSlot;
  recipeId?: string;
  /** Used instead of a recipe for "leftovers", "takeaway", etc. */
  customTitle?: string;
  servings: number;
  notes?: string;
  isCooked: boolean;
  cookedBy?: string;
}

export interface ExpenseCategory extends BaseRecord {
  name: string;
  colour: string;
  icon?: string;
  monthlyBudgetMinor?: number;
}

export interface Expense extends BaseRecord {
  /** Integer öre. Never a float. */
  amountMinor: number;
  categoryId?: string;
  description: string;
  /** ISO date, YYYY-MM-DD. */
  spentAt: string;
  receiptImageId?: string;
}

export interface ApartmentItem extends BaseRecord {
  name: string;
  notes?: string;
  url?: string;
  imageId?: string;
  estimatedCostMinor?: number;
  room?: string;
  priority: number;
  status: ApartmentStatus;
  /** profileId -> wants it. */
  votes: Record<string, boolean>;
}

export interface Errand extends BaseRecord {
  title: string;
  notes?: string;
  assignedTo?: string;
  dueDate?: string;
  isDone: boolean;
  doneBy?: string;
  doneAt?: string;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
}

export interface CalendarEvent extends BaseRecord {
  title: string;
  type: EventType;
  /** ISO datetime, or YYYY-MM-DD when allDay. */
  start: string;
  end?: string;
  allDay: boolean;
  location?: string;
  notes?: string;
  attendees: string[];
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
}

export interface CollectionMap {
  profiles: Profile;
  shopping: ShoppingItem;
  recipes: Recipe;
  meals: MealEntry;
  expenses: Expense;
  categories: ExpenseCategory;
  apartment: ApartmentItem;
  errands: Errand;
  events: CalendarEvent;
}

export type CollectionName = keyof CollectionMap;

import { useMemo, useState } from 'react';
import { getISOWeek } from 'date-fns';
import Sheet from '../components/Sheet';
import { addDaysIso, startOfWeekIso, todayIso, weekDates } from '../domain/dates';
import { MEAL_SLOTS, type MealEntry, type MealSlot } from '../domain/types';
import { api } from '../lib/api';
import { useCollection, useCreate, useRemove, useUpdate } from '../lib/hooks';

const DAY_NAMES = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];

const SLOT_NAMES: Record<MealSlot, string> = {
  breakfast: 'Frukost',
  lunch: 'Lunch',
  dinner: 'Middag',
  snack: 'Mellanmål',
};

/** Order meals within a day the way the day actually runs. */
const SLOT_ORDER: Record<MealSlot, number> = {
  breakfast: 0,
  lunch: 1,
  dinner: 2,
  snack: 3,
};

export default function MealPlan() {
  const [weekStart, setWeekStart] = useState(() => startOfWeekIso(todayIso()));
  const [adding, setAdding] = useState<string | null>(null);
  const [editing, setEditing] = useState<MealEntry | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dates = useMemo(() => weekDates(weekStart), [weekStart]);
  const weekEnd = dates[dates.length - 1];
  const today = todayIso();

  const meals = useCollection('meals', { from: weekStart, to: weekEnd });
  const recipes = useCollection('recipes');
  const events = useCollection('events', { from: weekStart, to: weekEnd });

  const createMeal = useCreate('meals');
  const updateMeal = useUpdate('meals', { month: weekStart.slice(0, 7) });
  const removeMeal = useRemove('meals', { month: weekStart.slice(0, 7) });

  /* Month shards are coarser than a week, so trim to the seven days shown. */
  const byDate = useMemo(() => {
    const map = new Map<string, MealEntry[]>();
    for (const entry of meals.data ?? []) {
      if (entry.date < weekStart || entry.date > weekEnd) continue;
      const list = map.get(entry.date) ?? [];
      list.push(entry);
      map.set(entry.date, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);
    }
    return map;
  }, [meals.data, weekStart, weekEnd]);

  /* Days spent travelling are dimmed — no point planning dinners you're away for. */
  const awayDates = useMemo(() => {
    const away = new Set<string>();
    for (const event of events.data ?? []) {
      if (event.type !== 'travel') continue;
      const from = event.start.slice(0, 10);
      const to = (event.end ?? event.start).slice(0, 10);
      for (const date of dates) {
        if (date >= from && date <= to) away.add(date);
      }
    }
    return away;
  }, [events.data, dates]);

  const titleOf = (entry: MealEntry): string => {
    if (entry.customTitle) return entry.customTitle;
    const recipe = recipes.data?.find((candidate) => candidate.id === entry.recipeId);
    return recipe?.title ?? 'Namnlös måltid';
  };

  const generate = async () => {
    setBusy(true);
    try {
      const result = await api.generateShopping(weekStart, weekEnd);
      setNote(
        result.created.length === 0
          ? 'Inget nytt att handla — allt finns redan på listan.'
          : `La till ${result.created.length} varor från ${result.mealsConsidered} måltider.`,
      );
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Kunde inte generera listan.');
    } finally {
      setBusy(false);
    }
  };

  const plannedCount = [...byDate.values()].reduce((total, list) => total + list.length, 0);

  return (
    <section>
      <div className="week-nav">
        <button
          type="button"
          className="btn-plain"
          onClick={() => setWeekStart(addDaysIso(weekStart, -7))}
          aria-label="Föregående vecka"
        >
          ←
        </button>
        <h2>Vecka {getISOWeek(new Date(`${weekStart}T00:00:00`))}</h2>
        <button
          type="button"
          className="btn-plain"
          onClick={() => setWeekStart(addDaysIso(weekStart, 7))}
          aria-label="Nästa vecka"
        >
          →
        </button>
      </div>

      <div className="days">
        {dates.map((date, index) => {
          const entries = byDate.get(date) ?? [];
          const classes = [
            'day',
            date === today ? 'day-today' : '',
            awayDates.has(date) ? 'day-away' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div key={date} className={classes}>
              <div className="day-when">
                <span className="day-name">{DAY_NAMES[index]?.slice(0, 3)}</span>
                <span className="day-date">{Number(date.slice(8, 10))}</span>
              </div>

              <div className="day-meals">
                {entries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className={`meal${entry.isCooked ? ' meal-cooked' : ''}`}
                    onClick={() => setEditing(entry)}
                  >
                    <span className="meal-slot">{SLOT_NAMES[entry.slot]}</span>
                    <span className="meal-title">{titleOf(entry)}</span>
                    <span className="meal-servings tabular">{entry.servings}p</span>
                  </button>
                ))}

                <button
                  type="button"
                  className={`day-add${entries.length > 0 ? ' day-add-bare' : ''}`}
                  onClick={() => setAdding(date)}
                  aria-label={`Lägg till måltid ${date}`}
                >
                  {entries.length > 0 ? '+' : '+ Lägg till'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="actions">
        <button type="button" className="btn" onClick={() => void generate()} disabled={busy || plannedCount === 0}>
          {busy ? 'Genererar…' : 'Skapa inköpslista för veckan'}
        </button>
      </div>

      {note && (
        <p className="empty" role="status">
          {note}
        </p>
      )}

      {editing && (
        <MealActions
          entry={editing}
          title={titleOf(editing)}
          onClose={() => setEditing(null)}
          onPatch={(patch) => updateMeal.mutate({ id: editing.id, patch })}
          onRemove={() => {
            removeMeal.mutate(editing.id);
            setEditing(null);
          }}
        />
      )}

      {adding && (
        <AddMeal
          date={adding}
          recipes={recipes.data ?? []}
          onClose={() => setAdding(null)}
          onAdd={(entry) => {
            createMeal.mutate({ ...entry, date: adding });
            setAdding(null);
          }}
        />
      )}
    </section>
  );
}

interface AddMealProps {
  date: string;
  recipes: { id: string; title: string; servings: number }[];
  onClose: () => void;
  onAdd: (entry: Partial<MealEntry>) => void;
}

/**
 * Picking a recipe is the common path, but a nullable recipe with a free-text
 * title matters just as much: plenty of dinners are leftovers, takeaway or
 * eating at someone else's, and forcing those through a recipe record would
 * make the planner tedious enough to abandon.
 */
function AddMeal({ date, recipes, onClose, onAdd }: AddMealProps) {
  const [slot, setSlot] = useState<MealSlot>('dinner');
  const [custom, setCustom] = useState('');

  return (
    <Sheet title={`Lägg till — ${date}`} onClose={onClose}>
      <div className="slot-picker">
        {MEAL_SLOTS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            className="chip"
            aria-pressed={slot === candidate}
            onClick={() => setSlot(candidate)}
          >
            {SLOT_NAMES[candidate]}
          </button>
        ))}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!custom.trim()) return;
          onAdd({ slot, customTitle: custom.trim(), servings: 2, isCooked: false });
        }}
      >
        <input
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          placeholder="Eller skriv fritt — rester, hämtmat…"
          aria-label="Egen måltid"
        />
      </form>

      <p className="label" style={{ marginTop: 'var(--space-5)' }}>
        Recept
      </p>

      {recipes.length === 0 ? (
        <p className="empty">Inga recept än.</p>
      ) : (
        <div className="pick-list">
          {recipes.map((recipe) => (
            <button
              key={recipe.id}
              type="button"
              className="pick"
              onClick={() =>
                onAdd({
                  slot,
                  recipeId: recipe.id,
                  servings: recipe.servings || 2,
                  isCooked: false,
                })
              }
            >
              <span className="pick-title">{recipe.title}</span>
              <span className="faint tabular">{recipe.servings}p</span>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}

interface MealActionsProps {
  entry: MealEntry;
  title: string;
  onClose: () => void;
  onPatch: (patch: Partial<MealEntry>) => void;
  onRemove: () => void;
}

/** Everything you can do to a planned meal, reachable by tapping it. */
function MealActions({ entry, title, onClose, onPatch, onRemove }: MealActionsProps) {
  const [servings, setServings] = useState(entry.servings);

  const changeServings = (next: number) => {
    const clamped = Math.max(1, Math.min(20, next));
    setServings(clamped);
    onPatch({ servings: clamped });
  };

  return (
    <Sheet title={title} onClose={onClose}>
      <div className="sheet-actions">
        <div className="sheet-action">
          <span>Portioner</span>
          <span className="stepper">
            <button type="button" onClick={() => changeServings(servings - 1)} aria-label="Färre portioner">
              −
            </button>
            <span className="tabular">{servings}</span>
            <button type="button" onClick={() => changeServings(servings + 1)} aria-label="Fler portioner">
              +
            </button>
          </span>
        </div>

        <button
          type="button"
          className="sheet-action"
          onClick={() => {
            onPatch({ isCooked: !entry.isCooked });
            onClose();
          }}
        >
          <span>{entry.isCooked ? 'Markera som ej lagad' : 'Markera som lagad'}</span>
          <span className="faint">{entry.isCooked ? '↺' : '✓'}</span>
        </button>

        <button type="button" className="sheet-action sheet-action-danger" onClick={onRemove}>
          <span>Ta bort</span>
          <span>×</span>
        </button>
      </div>
    </Sheet>
  );
}

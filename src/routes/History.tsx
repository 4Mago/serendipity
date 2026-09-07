import { useMemo, useState } from 'react';
import { monthKey, todayIso } from '../domain/dates';
import { useCollection } from '../lib/hooks';

const MONTH_NAMES = [
  'januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december',
];

function shiftMonth(month: string, delta: number): string {
  const [year, index] = month.split('-').map(Number);
  const date = new Date(year, index - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month: string): string {
  const [year, index] = month.split('-').map(Number);
  return `${MONTH_NAMES[index - 1]} ${year}`;
}

/**
 * What we actually ate, as opposed to what we planned. Two questions worth
 * answering: which recipes are carrying the month, and which ones we liked
 * enough to save but have quietly stopped cooking.
 */
export default function History() {
  const [month, setMonth] = useState(() => monthKey(todayIso()));

  const meals = useCollection('meals', { month });
  const recipes = useCollection('recipes');

  const { cooked, planned, ranked, neglected } = useMemo(() => {
    const entries = meals.data ?? [];
    const cookedEntries = entries.filter((entry) => entry.isCooked);

    const counts = new Map<string, number>();
    for (const entry of cookedEntries) {
      const key = entry.recipeId ?? `custom:${entry.customTitle ?? 'Övrigt'}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const titleOf = (key: string): string => {
      if (key.startsWith('custom:')) return key.slice(7);
      return recipes.data?.find((recipe) => recipe.id === key)?.title ?? 'Borttaget recept';
    };

    const rankedList = [...counts.entries()]
      .map(([key, count]) => ({ title: titleOf(key), count }))
      .sort((a, b) => b.count - a.count);

    /* Saved as a favourite, yet not cooked once this month. */
    const cookedIds = new Set(cookedEntries.map((entry) => entry.recipeId).filter(Boolean));
    const neglectedList = (recipes.data ?? [])
      .filter((recipe) => recipe.isFavourite && !cookedIds.has(recipe.id))
      .sort((a, b) => a.title.localeCompare(b.title, 'sv'));

    return {
      cooked: cookedEntries.length,
      planned: entries.length,
      ranked: rankedList,
      neglected: neglectedList,
    };
  }, [meals.data, recipes.data]);

  const most = ranked[0]?.count ?? 0;

  return (
    <section>
      <div className="week-nav">
        <button type="button" className="btn-plain" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Föregående månad">
          ←
        </button>
        <h2>{monthLabel(month)}</h2>
        <button type="button" className="btn-plain" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Nästa månad">
          →
        </button>
      </div>

      <p className="hero tabular">{cooked}</p>
      <p className="label hero-note">
        {cooked === 1 ? 'lagad måltid' : 'lagade måltider'}
        {planned > 0 ? ` av ${planned} ${planned === 1 ? 'planerad' : 'planerade'}` : ''}
      </p>

      {ranked.length === 0 ? (
        <p className="empty">
          Inget bockat som lagat den här månaden. Tryck på en måltid i matsedeln för att
          markera den.
        </p>
      ) : (
        <>
          <p className="label section-label">Mest lagat</p>
          <ul className="bars">
            {ranked.map((row) => (
              <li key={row.title} className="bar-row">
                <div className="bar-head">
                  <span className="bar-name">{row.title}</span>
                  <span className="bar-value tabular">{row.count} ggr</span>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${most === 0 ? 0 : (row.count / most) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {neglected.length > 0 && (
        <>
          <p className="label section-label">Favoriter ni glömt bort</p>
          <p className="hint faint">Sparade som favoriter men inte lagade den här månaden.</p>
          <div className="pick-list">
            {neglected.map((recipe) => (
              <div key={recipe.id} className="pick">
                <span className="pick-title">{recipe.title}</span>
                <span className="faint tabular">{recipe.servings}p</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

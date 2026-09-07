import { useMemo, useState } from 'react';
import Sheet from '../components/Sheet';
import { monthKey, todayIso } from '../domain/dates';
import { formatMinor, formatMinorRounded, parseToMinor, sumMinor } from '../domain/money';
import type { Expense, ExpenseCategory } from '../domain/types';
import { useCollection, useCreate, useRemove, useUpdate } from '../lib/hooks';

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

function daysInMonth(month: string): number {
  const [year, index] = month.split('-').map(Number);
  return new Date(year, index, 0).getDate();
}

export default function Expenses() {
  const [month, setMonth] = useState(() => monthKey(todayIso()));
  const [adding, setAdding] = useState(false);
  const [budgeting, setBudgeting] = useState(false);

  const expenses = useCollection('expenses', { month });
  const categories = useCollection('categories');
  const remove = useRemove('expenses', { month });

  const rows = useMemo(
    () =>
      [...(expenses.data ?? [])].sort((a, b) => b.spentAt.localeCompare(a.spentAt)),
    [expenses.data],
  );

  const total = sumMinor(rows.map((row) => row.amountMinor));

  const categoryName = (id: string | undefined): string =>
    categories.data?.find((candidate) => candidate.id === id)?.name ?? 'Övrigt';

  /*
   * Category totals, biggest first. Identity is carried by the label, not by
   * colour: the interface palette is deliberately muted and fails CVD
   * separation as a categorical scale, so the bars share one hue and length
   * does the encoding.
   */
  const byCategory = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of rows) {
      const key = categoryName(row.categoryId);
      totals.set(key, (totals.get(key) ?? 0) + row.amountMinor);
    }
    return [...totals.entries()].sort(([, a], [, b]) => b - a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, categories.data]);

  const largest = byCategory[0]?.[1] ?? 0;

  /*
   * Only the three largest categories get a hue, because three is the most
   * that stay mutually distinguishable under every colour-vision deficiency —
   * see the note on --chart-* in tokens.css. Everything below folds into a
   * neutral, and every bar is labelled with its name and value regardless, so
   * nothing here depends on colour being seen at all.
   */
  const hueFor = (rank: number): string =>
    rank < 3 ? `var(--chart-${rank + 1})` : 'var(--chart-rest)';

  /* Daily totals, for the change-over-time strip. */
  const daily = useMemo(() => {
    const count = daysInMonth(month);
    const totals = new Array<number>(count).fill(0);
    for (const row of rows) {
      const day = Number(row.spentAt.slice(8, 10));
      if (day >= 1 && day <= count) totals[day - 1] += row.amountMinor;
    }
    return totals;
  }, [rows, month]);

  const dailyMax = Math.max(...daily, 1);

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

      <p className="hero tabular">{formatMinorRounded(total)}</p>
      <p className="label hero-note">
        {rows.length} {rows.length === 1 ? 'utgift' : 'utgifter'}
      </p>

      {rows.length > 0 && (
        <>
          <div className="daily-strip" role="img" aria-label={`Daglig utgift i ${monthLabel(month)}`}>
            {daily.map((amount, index) => (
              <span
                key={index}
                className="daily-bar"
                style={{ height: `${Math.max(amount === 0 ? 0 : 6, (amount / dailyMax) * 100)}%` }}
                title={`${index + 1} ${monthLabel(month)}: ${formatMinor(amount)}`}
              />
            ))}
          </div>
          <div className="strip-axis label">
            <span>1</span>
            <span>{daily.length}</span>
          </div>

          <p className="label section-label">Per kategori</p>
          <ul className="bars">
            {byCategory.map(([name, amount], rank) => {
              const budget = categories.data?.find((candidate) => candidate.name === name)
                ?.monthlyBudgetMinor;
              return (
                <li key={name} className="bar-row">
                  <div className="bar-head">
                    <span className="bar-name">{name}</span>
                    <span className="bar-value tabular">
                      {formatMinorRounded(amount)}
                      {budget ? <span className="faint"> / {formatMinorRounded(budget)}</span> : null}
                    </span>
                  </div>
                  <div className="bar-track">
                    <div
                      className={`bar-fill${budget && amount > budget ? ' bar-over' : ''}`}
                      style={{
                        width: `${largest === 0 ? 0 : (amount / largest) * 100}%`,
                        '--bar-colour': hueFor(rank),
                      } as React.CSSProperties}
                    />
                  </div>
                  {budget && amount > budget && (
                    <p className="over-note">Över budget med {formatMinorRounded(amount - budget)}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className="actions">
        <button type="button" className="btn" onClick={() => setAdding(true)}>
          + Ny utgift
        </button>
        <button type="button" className="btn-plain" onClick={() => setBudgeting(true)}>
          Budgetar
        </button>
      </div>

      <p className="label section-label">Senaste</p>
      {rows.length === 0 ? (
        <p className="empty">Inga utgifter den här månaden.</p>
      ) : (
        <ul className="ledger">
          {rows.map((row) => (
            <li key={row.id} className="ledger-row">
              <span className="ledger-date label tabular">{row.spentAt.slice(8, 10)}/{row.spentAt.slice(5, 7)}</span>
              <span className="ledger-what">
                <span>{row.description || categoryName(row.categoryId)}</span>
                <span className="faint">{categoryName(row.categoryId)}</span>
              </span>
              <span className="ledger-amount tabular">{formatMinor(row.amountMinor)}</span>
              <button type="button" className="btn-plain" onClick={() => remove.mutate(row.id)} aria-label="Ta bort">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {budgeting && (
        <Budgets categories={categories.data ?? []} onClose={() => setBudgeting(false)} />
      )}

      {adding && (
        <AddExpense
          month={month}
          categories={categories.data ?? []}
          onClose={() => setAdding(false)}
        />
      )}
    </section>
  );
}

/**
 * A budget is what turns the category bars from a record into a warning, so
 * setting one is kept a single tap from the chart it affects.
 */
function Budgets({
  categories,
  onClose,
}: {
  categories: ExpenseCategory[];
  onClose: () => void;
}) {
  const update = useUpdate('categories');
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      categories.map((category) => [
        category.id,
        category.monthlyBudgetMinor ? String(category.monthlyBudgetMinor / 100) : '',
      ]),
    ),
  );

  const save = () => {
    for (const category of categories) {
      const raw = drafts[category.id] ?? '';
      const parsed = raw.trim() === '' ? undefined : (parseToMinor(raw) ?? undefined);
      if (parsed !== category.monthlyBudgetMinor) {
        update.mutate({ id: category.id, patch: { monthlyBudgetMinor: parsed } });
      }
    }
    onClose();
  };

  return (
    <Sheet title="Budget per månad" onClose={onClose}>
      {categories.length === 0 ? (
        <p className="empty">Inga kategorier än. De skapas när du bokför en utgift.</p>
      ) : (
        <>
          <p className="hint faint">Lämna tomt för ingen budget.</p>
          {categories.map((category) => (
            <div className="field" key={category.id}>
              <label className="label" htmlFor={`b-${category.id}`}>
                {category.name}
              </label>
              <input
                id={`b-${category.id}`}
                inputMode="decimal"
                value={drafts[category.id] ?? ''}
                onChange={(event) =>
                  setDrafts((current) => ({ ...current, [category.id]: event.target.value }))
                }
                placeholder="4 000"
              />
            </div>
          ))}
          <div className="actions">
            <button type="button" className="btn" onClick={save}>
              Spara
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

function AddExpense({
  month,
  categories,
  onClose,
}: {
  month: string;
  categories: ExpenseCategory[];
  onClose: () => void;
}) {
  const createExpense = useCreate('expenses');
  const createCategory = useCreate('categories');

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [spentAt, setSpentAt] = useState(() => {
    const today = todayIso();
    /* Default to today, unless browsing a past month. */
    return monthKey(today) === month ? today : `${month}-01`;
  });
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const amountMinor = parseToMinor(amount);
    if (amountMinor === null || amountMinor <= 0) {
      setError('Skriv ett belopp, t.ex. 249,50');
      return;
    }

    let finalCategory = categoryId;
    if (newCategory.trim()) {
      const created = await createCategory.mutateAsync({
        name: newCategory.trim(),
      } as Partial<ExpenseCategory>);
      finalCategory = created.id;
    }

    createExpense.mutate({
      amountMinor,
      description: description.trim(),
      categoryId: finalCategory || undefined,
      spentAt,
    } as Partial<Expense>);
    onClose();
  };

  return (
    <Sheet title="Ny utgift" onClose={onClose}>
      <div className="field">
        <label className="label" htmlFor="e-amount">
          Belopp
        </label>
        <input
          id="e-amount"
          inputMode="decimal"
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value);
            setError(null);
          }}
          placeholder="249,50"
          autoFocus
        />
        {error && <p className="hint sheet-action-danger">{error}</p>}
      </div>

      <div className="field">
        <label className="label" htmlFor="e-desc">
          Vad
        </label>
        <input
          id="e-desc"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="ICA, veckohandling"
        />
      </div>

      <div className="field">
        <label className="label" htmlFor="e-date">
          Datum
        </label>
        <input id="e-date" type="date" value={spentAt} onChange={(event) => setSpentAt(event.target.value)} />
      </div>

      <div className="field">
        <label className="label" htmlFor="e-cat">
          Kategori
        </label>
        <select
          id="e-cat"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          disabled={newCategory.trim() !== ''}
        >
          <option value="">Övrigt</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="label" htmlFor="e-newcat">
          …eller ny kategori
        </label>
        <input
          id="e-newcat"
          value={newCategory}
          onChange={(event) => setNewCategory(event.target.value)}
          placeholder="Mat, hyra, nöje…"
        />
      </div>

      <div className="actions">
        <button type="button" className="btn" onClick={() => void save()}>
          Spara
        </button>
      </div>
    </Sheet>
  );
}

import { useMemo, useState } from 'react';
import { CATEGORIES, CATEGORY_ORDER, type Category, type ShoppingItem } from '../domain/types';
import { formatQuantity } from '../domain/units';
import { useCollection, useCreate, useRemove, useUpdate } from '../lib/hooks';
import { parseToMinor } from '../domain/money';
import { todayIso } from '../domain/dates';
import type { Expense, ExpenseCategory } from '../domain/types';
import Sheet from '../components/Sheet';

const CATEGORY_NAMES: Record<Category, string> = {
  produce: 'Frukt & grönt',
  bakery: 'Bröd',
  meat: 'Kött',
  fish: 'Fisk',
  dairy: 'Mejeri',
  frozen: 'Fryst',
  pantry: 'Skafferi',
  drinks: 'Dryck',
  household: 'Hushåll',
  other: 'Övrigt',
};

export default function Shopping() {
  const items = useCollection('shopping');
  const create = useCreate('shopping');
  const update = useUpdate('shopping');
  const remove = useRemove('shopping');

  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [finishing, setFinishing] = useState(false);

  /* Grouped by aisle rather than by when it was added — the list is walked, not read. */
  const { aisles, done } = useMemo(() => {
    const open = (items.data ?? []).filter((item) => !item.isChecked);
    const checked = (items.data ?? []).filter((item) => item.isChecked);

    const grouped = new Map<Category, ShoppingItem[]>();
    for (const item of open) {
      const list = grouped.get(item.category) ?? [];
      list.push(item);
      grouped.set(item.category, list);
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name, 'sv'));
    }

    return {
      aisles: [...grouped.entries()].sort(
        ([a], [b]) => CATEGORY_ORDER[a] - CATEGORY_ORDER[b],
      ),
      done: checked,
    };
  }, [items.data]);

  const add = (event: React.FormEvent) => {
    event.preventDefault();
    const name = draft.trim();
    if (!name) return;
    create.mutate({ name, category: 'other', isChecked: false, quantity: null, unit: null });
    setDraft('');
  };

  const clearDone = () => done.forEach((item) => remove.mutate(item.id));

  return (
    <section>
      <div className="page-head">
        <h2>Inköp</h2>
        <span className="label tabular">
          {aisles.reduce((total, [, list]) => total + list.length, 0)} kvar
        </span>
      </div>

      <form onSubmit={add} className="add-row">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Lägg till vara"
          aria-label="Lägg till vara"
        />
        <button type="submit" className="btn-plain" aria-label="Lägg till">
          +
        </button>
      </form>

      {items.isLoading && <p className="empty">Laddar…</p>}

      {!items.isLoading && aisles.length === 0 && done.length === 0 && (
        <p className="empty">
          Listan är tom. Lägg till något ovan, eller skapa den från veckans matsedel.
        </p>
      )}

      {aisles.map(([category, list]) => (
        <div key={category} className="aisle">
          <p className="label aisle-name">{CATEGORY_NAMES[category]}</p>
          <ul>
            {list.map((item) => (
              <li key={item.id} className="buy">
                <button
                  type="button"
                  className="buy-tick"
                  onClick={() => update.mutate({ id: item.id, patch: { isChecked: true } })}
                  aria-label={`Bocka av ${item.name}`}
                >
                  <span className="tick-ring" />
                </button>
                <button type="button" className="buy-body" onClick={() => setEditing(item)}>
                  <span className="buy-name">{item.name}</span>
                  {item.sourceRecipeTitle && (
                    <span className="buy-source faint">{item.sourceRecipeTitle}</span>
                  )}
                </button>
                {item.quantity !== null && (
                  <span className="buy-qty tabular">
                    {formatQuantity(item.quantity)} {item.unit ?? ''}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {done.length > 0 && (
        <div className="aisle">
          <div className="aisle-head">
            <p className="label">I korgen · {done.length}</p>
            <button type="button" className="btn-plain" onClick={clearDone}>
              Rensa
            </button>
          </div>
          <ul>
            {done.map((item) => (
              <li key={item.id} className="buy buy-done">
                <button
                  type="button"
                  className="buy-tick"
                  onClick={() => update.mutate({ id: item.id, patch: { isChecked: false } })}
                  aria-label={`Ångra ${item.name}`}
                >
                  <span className="tick-ring tick-filled" />
                </button>
                <span className="buy-body">
                  <span className="buy-name">{item.name}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {done.length > 0 && (
        <div className="actions">
          <button type="button" className="btn" onClick={() => setFinishing(true)}>
            Klar med handlingen
          </button>
        </div>
      )}

      {finishing && (
        <FinishShop
          count={done.length}
          onClose={() => setFinishing(false)}
          onDone={() => {
            clearDone();
            setFinishing(false);
          }}
        />
      )}

      {editing && (
        <EditItem
          item={editing}
          onClose={() => setEditing(null)}
          onPatch={(patch) => update.mutate({ id: editing.id, patch })}
          onRemove={() => {
            remove.mutate(editing.id);
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}

interface EditItemProps {
  item: ShoppingItem;
  onClose: () => void;
  onPatch: (patch: Partial<ShoppingItem>) => void;
  onRemove: () => void;
}

function EditItem({ item, onClose, onPatch, onRemove }: EditItemProps) {
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity === null ? '' : String(item.quantity));
  const [unit, setUnit] = useState(item.unit ?? '');

  const save = () => {
    const parsed = quantity.trim() === '' ? null : Number(quantity.replace(',', '.'));
    onPatch({
      name: name.trim() || item.name,
      quantity: parsed !== null && Number.isFinite(parsed) ? parsed : null,
      unit: unit.trim() || null,
    });
    onClose();
  };

  return (
    <Sheet title={item.name} onClose={onClose}>
      <div className="field">
        <label className="label" htmlFor="item-name">
          Namn
        </label>
        <input id="item-name" value={name} onChange={(event) => setName(event.target.value)} />
      </div>

      <div className="field-row">
        <div className="field">
          <label className="label" htmlFor="item-qty">
            Mängd
          </label>
          <input
            id="item-qty"
            inputMode="decimal"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="item-unit">
            Enhet
          </label>
          <input id="item-unit" value={unit} onChange={(event) => setUnit(event.target.value)} />
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="item-cat">
          Avdelning
        </label>
        <select
          id="item-cat"
          value={item.category}
          onChange={(event) => onPatch({ category: event.target.value as Category })}
        >
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {CATEGORY_NAMES[category]}
            </option>
          ))}
        </select>
      </div>

      <div className="actions">
        <button type="button" className="btn" onClick={save}>
          Spara
        </button>
        <button type="button" className="btn-plain sheet-action-danger" onClick={onRemove}>
          Ta bort
        </button>
      </div>
    </Sheet>
  );
}

/**
 * The end of a shopping trip is the one moment the total is actually known, so
 * this is where an expense gets logged — otherwise the budget only ever gets
 * filled in from memory, days later.
 */
function FinishShop({
  count,
  onClose,
  onDone,
}: {
  count: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const categories = useCollection('categories');
  const createExpense = useCreate('expenses');
  const createCategory = useCreate('categories');

  const [amount, setAmount] = useState('');
  const [where, setWhere] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const finish = async (withExpense: boolean) => {
    if (!withExpense) {
      onDone();
      return;
    }

    const amountMinor = parseToMinor(amount);
    if (amountMinor === null || amountMinor <= 0) {
      setError('Skriv summan på kvittot, t.ex. 842,50');
      return;
    }

    let finalCategory = categoryId;
    if (!finalCategory) {
      /* Almost every shop is food; make that the path of least resistance. */
      const existing = categories.data?.find((candidate) => candidate.name === 'Mat');
      finalCategory =
        existing?.id ??
        (await createCategory.mutateAsync({ name: 'Mat' } as Partial<ExpenseCategory>)).id;
    }

    createExpense.mutate({
      amountMinor,
      description: where.trim() || 'Handling',
      categoryId: finalCategory,
      spentAt: todayIso(),
    } as Partial<Expense>);

    onDone();
  };

  return (
    <Sheet title="Klar med handlingen" onClose={onClose}>
      <p className="hint faint">
        {count} {count === 1 ? 'vara' : 'varor'} tas bort från listan. Vill du samtidigt bokföra
        vad det kostade?
      </p>

      <div className="field">
        <label className="label" htmlFor="s-amount">Summa på kvittot</label>
        <input
          id="s-amount"
          inputMode="decimal"
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value);
            setError(null);
          }}
          placeholder="842,50"
          autoFocus
        />
        {error && <p className="hint sheet-action-danger">{error}</p>}
      </div>

      <div className="field">
        <label className="label" htmlFor="s-where">Var</label>
        <input
          id="s-where"
          value={where}
          onChange={(event) => setWhere(event.target.value)}
          placeholder="ICA"
        />
      </div>

      <div className="field">
        <label className="label" htmlFor="s-cat">Kategori</label>
        <select id="s-cat" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">Mat</option>
          {(categories.data ?? []).map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="actions">
        <button type="button" className="btn" onClick={() => void finish(true)}>
          Bokför och rensa
        </button>
        <button type="button" className="btn-plain" onClick={() => void finish(false)}>
          Bara rensa
        </button>
      </div>
    </Sheet>
  );
}

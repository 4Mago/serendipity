import { useState } from 'react';
import { api } from '../lib/api';
import { useCollection, useCreate, useRemove, useUpdate } from '../lib/hooks';
import { formatMinor } from '../domain/money';
import { todayIso } from '../domain/dates';

/**
 * A throwaway harness for Phase A. It exercises every layer — list, create,
 * optimistic update, delete, the meal→shopping generator and the cursor
 * endpoint — so the plumbing can be verified on two real phones before any
 * design work starts. Delete once the real screens exist.
 */
export default function Diagnostics() {
  const shopping = useCollection('shopping');
  const create = useCreate('shopping');
  const update = useUpdate('shopping');
  const remove = useRemove('shopping');

  const [name, setName] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const today = todayIso();

  const generate = async () => {
    try {
      const result = await api.generateShopping(today, today);
      setNote(`Skapade ${result.created.length} rader från ${result.mealsConsidered} måltider.`);
      await shopping.refetch();
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Misslyckades');
    }
  };

  return (
    <section>
      <h2>Diagnostik</h2>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          create.mutate({ name: name.trim(), category: 'other', isChecked: false, quantity: null, unit: null });
          setName('');
        }}
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Lägg till vara"
          aria-label="Lägg till vara"
        />
        <button type="submit">Lägg till</button>
      </form>

      <p>
        <button type="button" onClick={() => void generate()}>
          Generera från dagens matsedel
        </button>{' '}
        <button type="button" onClick={() => void shopping.refetch()}>
          Uppdatera
        </button>
      </p>

      {note && <p className="muted">{note}</p>}
      {shopping.isLoading && <p>Laddar…</p>}
      {shopping.error && <p role="alert">{String(shopping.error)}</p>}

      <ul>
        {(shopping.data ?? []).map((item) => (
          <li key={item.id}>
            <label>
              <input
                type="checkbox"
                checked={item.isChecked}
                onChange={() => update.mutate({ id: item.id, patch: { isChecked: !item.isChecked } })}
              />{' '}
              {item.name}
              {item.quantity !== null && ` — ${item.quantity} ${item.unit ?? ''}`}
              {item.sourceRecipeTitle && <span className="muted"> ({item.sourceRecipeTitle})</span>}
            </label>{' '}
            <button type="button" onClick={() => remove.mutate(item.id)}>
              Ta bort
            </button>
          </li>
        ))}
      </ul>

      <p className="muted">
        {shopping.data?.length ?? 0} rader. Formatkontroll: {formatMinor(124950)}.
      </p>
    </section>
  );
}

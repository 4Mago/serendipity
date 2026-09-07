import { useMemo, useState } from 'react';
import { HOUSEHOLD, personById } from '../domain/household';
import { todayIso } from '../domain/dates';
import { useCollection, useCreate, useRemove, useUpdate } from '../lib/hooks';

export default function Errands() {
  const errands = useCollection('errands');
  const create = useCreate('errands');
  const update = useUpdate('errands');
  const remove = useRemove('errands');

  const [draft, setDraft] = useState('');
  const today = todayIso();

  const { open, done } = useMemo(() => {
    const all = errands.data ?? [];
    const sort = (list: typeof all) =>
      [...list].sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
    return {
      open: sort(all.filter((errand) => !errand.isDone)),
      done: all.filter((errand) => errand.isDone),
    };
  }, [errands.data]);

  return (
    <section>
      <div className="page-head">
        <h2>Sysslor</h2>
        <span className="label tabular">{open.length} kvar</span>
      </div>

      <form
        className="add-row"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.trim()) return;
          create.mutate({ title: draft.trim(), isDone: false, recurrence: 'none' });
          setDraft('');
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Lägg till syssla"
          aria-label="Lägg till syssla"
        />
        <button type="submit" className="btn-plain" aria-label="Lägg till">
          +
        </button>
      </form>

      {open.length === 0 && done.length === 0 && <p className="empty">Inget att göra. Fint.</p>}

      <ul>
        {open.map((errand) => {
          const owner = personById(errand.assignedTo);
          const overdue = errand.dueDate !== undefined && errand.dueDate < today;
          return (
            <li key={errand.id} className="buy">
              <button
                type="button"
                className="buy-tick"
                onClick={() => update.mutate({ id: errand.id, patch: { isDone: true, doneAt: new Date().toISOString() } })}
                aria-label={`Markera ${errand.title} som klar`}
              >
                <span className="tick-ring" />
              </button>
              <span className="buy-body">
                <span className="buy-name">{errand.title}</span>
                {errand.dueDate && (
                  <span className={overdue ? 'buy-source sheet-action-danger' : 'buy-source faint'}>
                    {errand.dueDate}
                  </span>
                )}
              </span>
              <span className="who-cycle">
                {HOUSEHOLD.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    className="who-chip"
                    aria-pressed={errand.assignedTo === person.id}
                    style={{ '--who-colour': person.colour } as React.CSSProperties}
                    onClick={() =>
                      update.mutate({
                        id: errand.id,
                        patch: { assignedTo: errand.assignedTo === person.id ? undefined : person.id },
                      })
                    }
                    title={owner?.id === person.id ? `${person.name} — tryck för att ta bort` : person.name}
                  >
                    {person.name.slice(0, 1)}
                  </button>
                ))}
              </span>
            </li>
          );
        })}
      </ul>

      {done.length > 0 && (
        <div className="aisle">
          <div className="aisle-head">
            <p className="label">Klart · {done.length}</p>
            <button type="button" className="btn-plain" onClick={() => done.forEach((errand) => remove.mutate(errand.id))}>
              Rensa
            </button>
          </div>
          <ul>
            {done.map((errand) => (
              <li key={errand.id} className="buy buy-done">
                <button
                  type="button"
                  className="buy-tick"
                  onClick={() => update.mutate({ id: errand.id, patch: { isDone: false } })}
                  aria-label={`Ångra ${errand.title}`}
                >
                  <span className="tick-ring tick-filled" />
                </button>
                <span className="buy-body">
                  <span className="buy-name">{errand.title}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

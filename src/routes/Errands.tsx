import { useMemo, useState } from 'react';
import Sheet from '../components/Sheet';
import { HOUSEHOLD, personById } from '../domain/household';
import { nextOccurrence, todayIso } from '../domain/dates';
import type { Errand } from '../domain/types';
import { useCollection, useCreate, useRemove, useUpdate } from '../lib/hooks';

const RECURRENCE_NAMES: Record<NonNullable<Errand['recurrence']>, string> = {
  none: 'En gång',
  daily: 'Varje dag',
  weekly: 'Varje vecka',
  monthly: 'Varje månad',
};

export default function Errands() {
  const errands = useCollection('errands');
  const create = useCreate('errands');
  const update = useUpdate('errands');
  const remove = useRemove('errands');

  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<Errand | null>(null);
  const today = todayIso();

  /*
   * Completing a recurring errand schedules the next one rather than just
   * ticking this one off — otherwise "every week" quietly becomes "once".
   */
  const complete = (errand: Errand) => {
    update.mutate({ id: errand.id, patch: { isDone: true, doneAt: new Date().toISOString() } });

    const next = nextOccurrence(errand.dueDate ?? today, errand.recurrence);
    if (next) {
      create.mutate({
        title: errand.title,
        notes: errand.notes,
        assignedTo: errand.assignedTo,
        dueDate: next,
        recurrence: errand.recurrence,
        isDone: false,
      });
    }
  };

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
                onClick={() => complete(errand)}
                aria-label={`Markera ${errand.title} som klar`}
              >
                <span className="tick-ring" />
              </button>
              <button type="button" className="buy-body" onClick={() => setEditing(errand)}>
                <span className="buy-name">{errand.title}</span>
                <span className={overdue ? 'buy-source sheet-action-danger' : 'buy-source faint'}>
                  {overdue ? 'Försenad · ' : ''}
                  {errand.dueDate ?? 'inget datum'}
                  {errand.recurrence && errand.recurrence !== 'none'
                    ? ` · ${RECURRENCE_NAMES[errand.recurrence].toLowerCase()}`
                    : ''}
                </span>
              </button>
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

      {editing && (
        <EditErrand
          errand={editing}
          onClose={() => setEditing(null)}
          onPatch={(patch) => update.mutate({ id: editing.id, patch })}
          onRemove={() => {
            remove.mutate(editing.id);
            setEditing(null);
          }}
        />
      )}

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

function EditErrand({
  errand,
  onClose,
  onPatch,
  onRemove,
}: {
  errand: Errand;
  onClose: () => void;
  onPatch: (patch: Partial<Errand>) => void;
  onRemove: () => void;
}) {
  const [title, setTitle] = useState(errand.title);
  const [dueDate, setDueDate] = useState(errand.dueDate ?? '');
  const [recurrence, setRecurrence] = useState(errand.recurrence ?? 'none');
  const [notes, setNotes] = useState(errand.notes ?? '');

  return (
    <Sheet title={errand.title} onClose={onClose}>
      <div className="field">
        <label className="label" htmlFor="er-title">Vad</label>
        <input id="er-title" value={title} onChange={(event) => setTitle(event.target.value)} />
      </div>

      <div className="field">
        <label className="label" htmlFor="er-due">Senast</label>
        <input id="er-due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
      </div>

      <p className="label">Upprepas</p>
      <div className="slot-picker">
        {(Object.keys(RECURRENCE_NAMES) as NonNullable<Errand['recurrence']>[]).map((option) => (
          <button
            key={option}
            type="button"
            className="chip"
            aria-pressed={recurrence === option}
            onClick={() => setRecurrence(option)}
          >
            {RECURRENCE_NAMES[option]}
          </button>
        ))}
      </div>
      {recurrence !== 'none' && (
        <p className="hint faint">
          När du bockar av den skapas nästa automatiskt.
        </p>
      )}

      <div className="field">
        <label className="label" htmlFor="er-notes">Anteckning</label>
        <textarea id="er-notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </div>

      <div className="actions">
        <button
          type="button"
          className="btn"
          onClick={() => {
            onPatch({
              title: title.trim() || errand.title,
              dueDate: dueDate || undefined,
              recurrence,
              notes: notes.trim() || undefined,
            });
            onClose();
          }}
        >
          Spara
        </button>
        <button type="button" className="btn-plain sheet-action-danger" onClick={onRemove}>
          Ta bort
        </button>
      </div>
    </Sheet>
  );
}

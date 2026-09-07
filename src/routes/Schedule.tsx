import { useMemo, useState } from 'react';
import Sheet from '../components/Sheet';
import { monthKey, todayIso } from '../domain/dates';
import { HOUSEHOLD } from '../domain/household';
import type { CalendarEvent, EventType } from '../domain/types';
import { useCollection, useCreate, useRemove } from '../lib/hooks';

const TYPE_NAMES: Record<EventType, string> = {
  gym: 'Träning',
  travel: 'Resa',
  social: 'Socialt',
  appointment: 'Tid',
  other: 'Övrigt',
};

/* Reinforcement beside a text label, never the sole encoding. */
const TYPE_COLOUR: Record<EventType, string> = {
  gym: 'var(--arta)',
  travel: 'var(--hav)',
  social: 'var(--citrus)',
  appointment: 'var(--lok)',
  other: 'var(--ink-faint)',
};

export default function Schedule() {
  const [month, setMonth] = useState(() => monthKey(todayIso()));
  const [adding, setAdding] = useState(false);

  const events = useCollection('events', { month });
  const remove = useRemove('events', { month });
  const today = todayIso();

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events.data ?? []) {
      const date = event.start.slice(0, 10);
      const list = map.get(date) ?? [];
      list.push(event);
      map.set(date, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [events.data]);

  return (
    <section>
      <div className="page-head">
        <h2>Kalender</h2>
        <button type="button" className="btn-plain" onClick={() => setAdding(true)}>
          + Nytt
        </button>
      </div>

      <div className="month-switch">
        <input
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          aria-label="Månad"
        />
      </div>

      {byDate.length === 0 && <p className="empty">Inget inplanerat den här månaden.</p>}

      <div className="days">
        {byDate.map(([date, list]) => (
          <div key={date} className={`day${date === today ? ' day-today' : ''}`}>
            <div className="day-when">
              <span className="day-name">{new Date(`${date}T00:00:00`).toLocaleDateString('sv-SE', { weekday: 'short' })}</span>
              <span className="day-date">{Number(date.slice(8, 10))}</span>
            </div>
            <div className="day-meals">
              {list.map((event) => (
                <div key={event.id} className="meal">
                  <span className="event-dot" style={{ background: TYPE_COLOUR[event.type] }} />
                  <span className="meal-title">{event.title}</span>
                  <span className="meal-servings">{TYPE_NAMES[event.type]}</span>
                  <button type="button" className="btn-plain" onClick={() => remove.mutate(event.id)} aria-label="Ta bort">
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {adding && <AddEvent month={month} onClose={() => setAdding(false)} />}
    </section>
  );
}

function AddEvent({ month, onClose }: { month: string; onClose: () => void }) {
  const create = useCreate('events');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<EventType>('gym');
  const [start, setStart] = useState(() =>
    monthKey(todayIso()) === month ? todayIso() : `${month}-01`,
  );
  const [end, setEnd] = useState('');
  const [attendees, setAttendees] = useState<string[]>(HOUSEHOLD.map((person) => person.id));

  return (
    <Sheet title="Nytt i kalendern" onClose={onClose}>
      <div className="field">
        <label className="label" htmlFor="ev-title">Vad</label>
        <input id="ev-title" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
      </div>

      <div className="slot-picker">
        {(Object.keys(TYPE_NAMES) as EventType[]).map((candidate) => (
          <button
            key={candidate}
            type="button"
            className="chip"
            aria-pressed={type === candidate}
            onClick={() => setType(candidate)}
          >
            {TYPE_NAMES[candidate]}
          </button>
        ))}
      </div>

      <div className="field-row">
        <div className="field">
          <label className="label" htmlFor="ev-start">Från</label>
          <input id="ev-start" type="date" value={start} onChange={(event) => setStart(event.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="ev-end">Till</label>
          <input id="ev-end" type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
        </div>
      </div>

      <p className="hint faint">
        En resa som sträcker sig över flera dagar tonar ned matsedeln för de dagarna.
      </p>

      <div className="slot-picker">
        {HOUSEHOLD.map((person) => (
          <button
            key={person.id}
            type="button"
            className="chip"
            aria-pressed={attendees.includes(person.id)}
            onClick={() =>
              setAttendees((current) =>
                current.includes(person.id)
                  ? current.filter((id) => id !== person.id)
                  : [...current, person.id],
              )
            }
          >
            {person.name}
          </button>
        ))}
      </div>

      <div className="actions">
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (!title.trim()) return;
            create.mutate({
              title: title.trim(),
              type,
              start,
              end: end || undefined,
              allDay: true,
              attendees,
              recurrence: 'none',
            });
            onClose();
          }}
        >
          Spara
        </button>
      </div>
    </Sheet>
  );
}

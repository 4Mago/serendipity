import { useState } from 'react';
import Sheet from '../components/Sheet';
import { HOUSEHOLD } from '../domain/household';
import { formatMinor, parseToMinor } from '../domain/money';
import type { ApartmentItem, ApartmentStatus } from '../domain/types';
import { useCollection, useCreate, useRemove, useUpdate } from '../lib/hooks';
import { getWhoami } from '../lib/whoami';

const STATUS_NAMES: Record<ApartmentStatus, string> = {
  idea: 'Idé',
  agreed: 'Överens',
  ordered: 'Beställd',
  bought: 'Köpt',
};

const STATUS_ORDER: ApartmentStatus[] = ['idea', 'agreed', 'ordered', 'bought'];

export default function Apartment() {
  const items = useCollection('apartment');
  const create = useCreate('apartment');
  const update = useUpdate('apartment');
  const remove = useRemove('apartment');

  const [adding, setAdding] = useState(false);
  const me = getWhoami();

  const grouped = STATUS_ORDER.map((status) => ({
    status,
    list: (items.data ?? []).filter((item) => item.status === status),
  })).filter((group) => group.list.length > 0);

  /* Both wanting it is the whole point of a shared wishlist. */
  const toggleVote = (item: ApartmentItem) => {
    if (!me) return;
    const votes = { ...item.votes, [me.id]: !item.votes[me.id] };
    update.mutate({ id: item.id, patch: { votes } });
  };

  const cycleStatus = (item: ApartmentItem) => {
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(item.status) + 1) % STATUS_ORDER.length];
    update.mutate({ id: item.id, patch: { status: next } });
  };

  return (
    <section>
      <div className="page-head">
        <h2>Hemmet</h2>
        <button type="button" className="btn-plain" onClick={() => setAdding(true)}>
          + Nytt
        </button>
      </div>

      {grouped.length === 0 && <p className="empty">Inget på önskelistan än.</p>}

      {grouped.map(({ status, list }) => (
        <div key={status} className="aisle">
          <p className="label aisle-name">{STATUS_NAMES[status]}</p>
          <ul>
            {list.map((item) => {
              const wanted = HOUSEHOLD.filter((person) => item.votes[person.id]);
              const both = wanted.length === HOUSEHOLD.length;
              return (
                <li key={item.id} className="wish">
                  <button type="button" className="wish-name" onClick={() => cycleStatus(item)}>
                    <span className="buy-name">{item.name}</span>
                  </button>

                  <button
                    type="button"
                    className="btn-plain wish-heart"
                    onClick={() => toggleVote(item)}
                    aria-label={me ? `${me.name}: rösta på ${item.name}` : 'Välj vem du är först'}
                    disabled={!me}
                  >
                    {me && item.votes[me.id] ? '♥' : '♡'}
                  </button>

                  <button
                    type="button"
                    className="btn-plain wish-remove"
                    onClick={() => remove.mutate(item.id)}
                    aria-label="Ta bort"
                  >
                    ×
                  </button>

                  <span className="wish-meta">
                    {item.url && (
                      <a
                        className="wish-link"
                        href={item.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        onClick={(event) => event.stopPropagation()}
                      >
                        Länk
                      </a>
                    )}
                    <span className="faint">
                      {item.room ? `${item.room} · ` : ''}
                      {both
                        ? 'båda vill ha den'
                        : wanted.length === 1
                          ? `${wanted[0]?.name} vill ha den`
                          : 'ingen röst än'}
                    </span>
                    {item.estimatedCostMinor !== undefined && (
                      <span className="tabular wish-cost">{formatMinor(item.estimatedCostMinor)}</span>
                    )}
                    <span className="who-cycle">
                      {HOUSEHOLD.map((person) => (
                        <span
                          key={person.id}
                          className="who-chip"
                          aria-hidden="true"
                          data-voted={item.votes[person.id] ? 'true' : 'false'}
                          style={{ '--who-colour': person.colour } as React.CSSProperties}
                        >
                          {person.name.slice(0, 1)}
                        </span>
                      ))}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {adding && (
        <AddWish
          onClose={() => setAdding(false)}
          onSave={(item) => {
            create.mutate(item);
            setAdding(false);
          }}
        />
      )}
    </section>
  );
}

function AddWish({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (item: Partial<ApartmentItem>) => void;
}) {
  const me = getWhoami();
  const [name, setName] = useState('');
  const [room, setRoom] = useState('');
  const [cost, setCost] = useState('');
  const [url, setUrl] = useState('');

  return (
    <Sheet title="Till hemmet" onClose={onClose}>
      <div className="field">
        <label className="label" htmlFor="w-name">Vad</label>
        <input id="w-name" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
      </div>

      <div className="field-row">
        <div className="field">
          <label className="label" htmlFor="w-room">Rum</label>
          <input id="w-room" value={room} onChange={(event) => setRoom(event.target.value)} placeholder="Vardagsrum" />
        </div>
        <div className="field">
          <label className="label" htmlFor="w-cost">Ungefär</label>
          <input id="w-cost" inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} placeholder="2 500" />
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="w-url">Länk</label>
        <input id="w-url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" />
      </div>

      <div className="actions">
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (!name.trim()) return;
            const parsed = parseToMinor(cost);
            onSave({
              name: name.trim(),
              room: room.trim() || undefined,
              estimatedCostMinor: parsed !== null && parsed > 0 ? parsed : undefined,
              url: url.trim() || undefined,
              status: 'idea',
              priority: 0,
              /* Whoever adds it evidently wants it. */
              votes: me ? { [me.id]: true } : {},
            });
          }}
        >
          Spara
        </button>
      </div>
    </Sheet>
  );
}

import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { useMutationState } from '@tanstack/react-query';
import MealPlan from './routes/MealPlan';
import Shopping from './routes/Shopping';
import Recipes from './routes/Recipes';
import Expenses from './routes/Expenses';
import Errands from './routes/Errands';
import Schedule from './routes/Schedule';
import Apartment from './routes/Apartment';
import Diagnostics from './routes/Diagnostics';
import { useChangePolling } from './lib/hooks';
import { HOUSEHOLD, type Person } from './domain/household';
import { clearWhoami, getWhoami, setWhoami } from './lib/whoami';
import { setupServiceWorker } from './lib/pwa';

/** Five is the most a bottom bar can hold before targets get too small. */
const TABS = [
  { path: '/', label: 'Matsedel' },
  { path: '/shopping', label: 'Inköp' },
  { path: '/recipes', label: 'Recept' },
  { path: '/expenses', label: 'Utgifter' },
  { path: '/more', label: 'Mer' },
];

export default function App() {
  const [person, setPerson] = useState<Person | null>(() => getWhoami());
  const [applyUpdate, setApplyUpdate] = useState<(() => void) | null>(null);

  useEffect(() => setupServiceWorker((apply) => setApplyUpdate(() => apply)), []);

  /*
   * Not a login. The app has no accounts; this only records which of the two
   * people is holding the phone, so records can show who added them.
   */
  if (!person) {
    return (
      <main className="gate">
        <h1>Hemma</h1>
        <p className="label">Vem är du?</p>
        <div className="who-picker">
          {HOUSEHOLD.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              className="who"
              style={{ '--who-colour': candidate.colour } as React.CSSProperties}
              onClick={() => {
                setWhoami(candidate);
                setPerson(candidate);
              }}
            >
              <span className="who-dot" />
              {candidate.name}
            </button>
          ))}
        </div>
      </main>
    );
  }

  return (
    <div className="shell">
      {applyUpdate && (
        <div className="banner">
          <span>En ny version finns.</span>
          <button type="button" className="btn-plain" onClick={applyUpdate}>
            Uppdatera
          </button>
        </div>
      )}

      <SyncStatus />

      <main className="shell-main">
        <Routes>
          <Route path="/" element={<MealPlan />} />
          <Route path="/shopping" element={<Shopping />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route
            path="/more"
            element={
              <More
                person={person}
                onSwitch={() => {
                  clearWhoami();
                  setPerson(null);
                }}
              />
            }
          />
          <Route path="/errands" element={<Errands />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/apartment" element={<Apartment />} />
          <Route path="/diagnostics" element={<Diagnostics />} />
          <Route path="*" element={<Placeholder title="Hittades inte" />} />
        </Routes>
      </main>

      <nav className="tabs">
        {TABS.map((tab) => (
          <NavLink key={tab.path} to={tab.path} end={tab.path === '/'}>
            <span className="tab-mark" />
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** Surfaces the two states that are otherwise invisible and confusing. */
function SyncStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const pending = useMutationState({ filters: { status: 'pending' } });

  useChangePolling();

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (online && pending.length === 0) return null;

  return (
    <div className="banner" role="status">
      <span>
        {online
          ? `Synkar ${pending.length} ändringar…`
          : 'Offline — ändringar sparas och skickas när du är uppkopplad'}
      </span>
    </div>
  );
}

function More({ person, onSwitch }: { person: Person; onSwitch: () => void }) {
  return (
    <section>
      <div className="page-head">
        <h2>Mer</h2>
        <span className="label">{person.name}</span>
      </div>
      <div className="pick-list">
        {[
          { to: '/errands', label: 'Sysslor' },
          { to: '/schedule', label: 'Kalender' },
          { to: '/apartment', label: 'Hemmet' },
          { to: '/diagnostics', label: 'Diagnostik' },
        ].map((item) => (
          <Link key={item.to} to={item.to} className="pick">
            <span className="pick-title">{item.label}</span>
            <span className="faint">→</span>
          </Link>
        ))}
      </div>
      <div className="actions">
        <button type="button" className="btn" onClick={onSwitch}>
          Byt användare
        </button>
      </div>
    </section>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <section>
      <div className="page-head">
        <h2>{title}</h2>
      </div>
      <p className="empty">Byggs härnäst.</p>
    </section>
  );
}

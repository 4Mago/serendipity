import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { useMutationState } from '@tanstack/react-query';
import MealPlan from './routes/MealPlan';
import Diagnostics from './routes/Diagnostics';
import { useChangePolling } from './lib/hooks';
import { currentUser, logout, onAuthChange, openLogin } from './lib/identity';
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
  const [user, setUser] = useState(() => currentUser());
  const [applyUpdate, setApplyUpdate] = useState<(() => void) | null>(null);

  useEffect(() => onAuthChange(setUser), []);
  useEffect(() => setupServiceWorker((apply) => setApplyUpdate(() => apply)), []);

  if (!user) {
    return (
      <main className="gate">
        <h1>Hemma</h1>
        <p className="label">Marcus &amp; Clara</p>
        <button type="button" className="btn" onClick={openLogin}>
          Logga in
        </button>
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
          <Route path="/shopping" element={<Placeholder title="Inköp" />} />
          <Route path="/recipes" element={<Placeholder title="Recept" />} />
          <Route path="/expenses" element={<Placeholder title="Utgifter" />} />
          <Route path="/more" element={<More />} />
          <Route path="/errands" element={<Placeholder title="Sysslor" />} />
          <Route path="/schedule" element={<Placeholder title="Kalender" />} />
          <Route path="/apartment" element={<Placeholder title="Hemmet" />} />
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

function More() {
  return (
    <section>
      <div className="page-head">
        <h2>Mer</h2>
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
        <button type="button" className="btn" onClick={logout}>
          Logga ut
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

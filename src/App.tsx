import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { useMutationState } from '@tanstack/react-query';
import { useChangePolling } from './lib/hooks';
import { currentUser, logout, onAuthChange, openLogin } from './lib/identity';
import { setupServiceWorker } from './lib/pwa';
import Diagnostics from './routes/Diagnostics';

/**
 * Phase A shell: deliberately unstyled. It exists to prove auth, routing,
 * polling and the offline queue work end to end. The real design lands in
 * Phase B, once reference images are in.
 */

const SECTIONS = [
  { path: '/', label: 'Veckan' },
  { path: '/meals', label: 'Matsedel' },
  { path: '/shopping', label: 'Inköp' },
  { path: '/recipes', label: 'Recept' },
  { path: '/expenses', label: 'Utgifter' },
  { path: '/errands', label: 'Sysslor' },
  { path: '/schedule', label: 'Kalender' },
  { path: '/apartment', label: 'Hemmet' },
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
        <p>Marcus &amp; Clara</p>
        <button type="button" onClick={openLogin}>
          Logga in
        </button>
      </main>
    );
  }

  return (
    <div className="app">
      {applyUpdate && (
        <div className="banner">
          En ny version finns.{' '}
          <button type="button" onClick={applyUpdate}>
            Uppdatera
          </button>
        </div>
      )}

      <SyncStatus />

      <nav className="nav">
        {SECTIONS.map((section) => (
          <NavLink key={section.path} to={section.path} end={section.path === '/'}>
            {section.label}
          </NavLink>
        ))}
      </nav>

      <main className="main">
        <Routes>
          <Route path="/" element={<Placeholder title="Veckan" />} />
          <Route path="/meals" element={<Placeholder title="Matsedel" />} />
          <Route path="/shopping" element={<Placeholder title="Inköp" />} />
          <Route path="/recipes" element={<Placeholder title="Recept" />} />
          <Route path="/expenses" element={<Placeholder title="Utgifter" />} />
          <Route path="/errands" element={<Placeholder title="Sysslor" />} />
          <Route path="/schedule" element={<Placeholder title="Kalender" />} />
          <Route path="/apartment" element={<Placeholder title="Hemmet" />} />
          <Route path="/diagnostics" element={<Diagnostics />} />
          <Route path="*" element={<Placeholder title="Hittades inte" />} />
        </Routes>
      </main>

      <footer className="footer">
        <Link to="/diagnostics">Diagnostik</Link>
        <button type="button" onClick={logout}>
          Logga ut
        </button>
      </footer>
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
      {online ? `Synkar ${pending.length} ändringar…` : 'Offline — ändringar sparas och skickas sen'}
    </div>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <section>
      <h2>{title}</h2>
      <p className="muted">Byggs i fas B, när formgivningen är på plats.</p>
    </section>
  );
}

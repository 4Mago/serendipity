import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import App from './App';
import { initIdentity } from './lib/identity';
import { persister, queryClient } from './lib/queryClient';
import './index.css';

const WEEK = 1000 * 60 * 60 * 24 * 7;

initIdentity();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');

createRoot(root).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: WEEK }}
      // Anything queued while offline replays as soon as the cache is back —
      // this is what makes ticking items off in a dead-signal supermarket safe.
      onSuccess={() => void queryClient.resumePausedMutations()}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PersistQueryClientProvider>
  </StrictMode>,
);

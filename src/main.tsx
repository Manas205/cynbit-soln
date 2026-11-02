import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './styles.css';

const AdminDashboard = lazy(() => import('./AdminDashboard.tsx'));

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/^\/admin\/?$/.test(window.location.pathname) ? (
      <Suspense
        fallback={
          <p role="status" style={{ padding: 32 }}>
            Opening admin workspace…
          </p>
        }
      >
        <AdminDashboard />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>,
);

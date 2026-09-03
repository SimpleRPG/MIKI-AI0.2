import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { storageService } from './services/storageService';
import './index.css';

// Prevent WebGPU / background abort recoverable notices from triggering parent frame tab shifts
window.addEventListener('unhandledrejection', (event) => {
  const reason = String(event?.reason?.message || event?.reason || '');
  if (
    reason.includes('Device was lost') ||
    reason.includes('GPUBuffer') ||
    reason.includes('unmapped') ||
    reason.includes('AbortError') ||
    reason.includes('aborted') ||
    reason.includes('plugin is not implemented')
  ) {
    event.preventDefault();
  }
});

window.addEventListener('error', (event) => {
  const msg = String(event?.message || '');
  if (
    msg.includes('ResizeObserver') ||
    msg.includes('Device was lost') ||
    msg.includes('GPUBuffer') ||
    msg.includes('unmapped') ||
    msg.includes('plugin is not implemented')
  ) {
    event.preventDefault();
  }
});

const root = ReactDOM.createRoot(document.getElementById('root')!);

// App.tsx and several services (backgroundWorkerService, skillsService,
// selfImprovementService, etc.) read persisted state synchronously on first
// render/construction via storageService. Wait for it to finish hydrating
// from SQLite/IndexedDB (and migrating any pre-existing localStorage data)
// before mounting, so that first render already sees real data instead of
// an empty cache.
storageService.ready.finally(() => {
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
});


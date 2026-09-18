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

// 設計思想 58章 (中断・再開・回復能力) & SECTION 5 (データを壊さない境界)
// アプリがバックグラウンドへ回った瞬間・閉じられる瞬間に、
// storageServiceの遅延書き込み(最大400ms分)を即座に確定させる。
const flushOnHide = () => {
  storageService.flushNow().catch((e) =>
    console.warn('storageService: flush on hide failed', e)
  );
};
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    flushOnHide();
  }
});
window.addEventListener('pagehide', flushOnHide);
window.addEventListener('beforeunload', flushOnHide);

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


import React from 'react';
import ReactDOM from 'react-dom/client';
import { storageService } from './services/storageService';
import { startupRecoveryService } from './services/startupRecoveryService';
import { nonBlockingStartupP156Service } from './services/nonBlockingStartupP156Service';
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

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('ROOT_ELEMENT_NOT_FOUND');
}
const root = ReactDOM.createRoot(rootElement);
startupRecoveryService.update('STORAGE_WAIT', 'Waiting for persistent storage hydration');

root.render(
  <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200 text-sm" role="status" aria-live="polite">
    MIKI 起動中...
  </div>
);

const renderApp = async () => {
  startupRecoveryService.update('APP_IMPORT', 'Loading application modules');
  const [{ default: App }, { ErrorBoundary }] = await Promise.all([
    import('./App'),
    import('./components/ErrorBoundary'),
  ]);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200">MIKI 読み込み中...</div>}>
          <App />
        </React.Suspense>
      </ErrorBoundary>
    </React.StrictMode>
  );
  startupRecoveryService.update('APP_RENDERED', 'Application root rendered');
  window.setTimeout(() => startupRecoveryService.clear(), 3000);
};

void nonBlockingStartupP156Service.awaitWithoutBlocking(storageService.ready)
  .then((outcome) => {
    if (outcome.mode === 'LIMITED') {
      startupRecoveryService.update('APP_IMPORT', 'Persistent storage unavailable; continuing in limited mode');
    }
    return renderApp();
  })
  .then(() => import('./services/systemLogger'))
  .then(({ systemLogger }) => systemLogger.initializeRuntimeMemoryDiagnostics())
  .catch((error) => {
    console.error('MIKI application bootstrap failed', error);
    startupRecoveryService.renderFatal(rootElement, error);
  });

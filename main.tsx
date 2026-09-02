import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);


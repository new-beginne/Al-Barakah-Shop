import { registerSW } from 'virtual:pwa-register';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { requestPersistentStorage } from './lib/storagePersistence';
import { ErrorBoundary } from './components/ErrorBoundary';

// Ensure IndexedDB is never wiped out or evicted on reinstall/storage pressure
try {
  requestPersistentStorage().catch(console.warn);
} catch {
  // ignore in sandboxed environments
}

// In iframes or development preview, unregister any stale service workers to prevent cache trapping
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    if (window.self !== window.top || import.meta.env.DEV) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        for (const reg of regs) {
          reg.unregister().catch(() => {});
        }
      }).catch(() => {});
      if ('caches' in window) {
        caches.keys().then(keys => {
          for (const key of keys) {
            caches.delete(key).catch(() => {});
          }
        }).catch(() => {});
      }
    } else {
      registerSW({
        immediate: true,
        onRegisterError(err) {
          console.debug('PWA ServiceWorker registration notice:', err);
        },
      });
    }
  } catch (err) {
    console.debug('ServiceWorker setup deferred:', err);
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}

import { registerSW } from 'virtual:pwa-register';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { requestPersistentStorage } from './lib/storagePersistence';

// Ensure IndexedDB is never wiped out or evicted on reinstall/storage pressure
requestPersistentStorage().catch(console.warn);

// Register service worker safely
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    registerSW({
      immediate: true,
      onRegisterError(err) {
        console.debug('PWA ServiceWorker registration notice:', err);
      },
    });
  } catch (err) {
    // Suppress dev-time websocket/send issues gracefully
    console.debug('PWA registration deferred:', err);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import { registerSW } from 'virtual:pwa-register';
registerSW({ immediate: true });
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { requestPersistentStorage } from './lib/storagePersistence';

// Ensure IndexedDB is never wiped out or evicted on reinstall/storage pressure
requestPersistentStorage().catch(console.warn);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

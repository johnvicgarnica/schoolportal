import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeOfflineDatabase } from './lib/offlineStore';

// Warm up offline database and sanitize any sensitive stored fields
initializeOfflineDatabase();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

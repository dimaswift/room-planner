import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { THEMES, itemSheet, roomSheet } from './export/sheets';
import { useStore } from './store';
import './styles.css';

if (import.meta.env.DEV) (window as any).__rp = { useStore, itemSheet, roomSheet, THEMES };

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

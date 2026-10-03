import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './responsive.css';
import { initGlobalErrorLogging } from './services/logger';

// Initialize production Vercel error ingestion
initGlobalErrorLogging();

declare global {
  interface Window {
    global?: any;
    Cashfree?: any;
  }
}

if (typeof window !== 'undefined' && typeof window.global === 'undefined') {
  window.global = window;
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

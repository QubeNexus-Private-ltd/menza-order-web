import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './responsive.css';

if (typeof window !== 'undefined' && typeof window.global === 'undefined') {
  window.global = window;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

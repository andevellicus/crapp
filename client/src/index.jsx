// src/index.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Import interaction tracker
import './interaction-tracker';

const root = ReactDOM.createRoot(document.getElementById('react-root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
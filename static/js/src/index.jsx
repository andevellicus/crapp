// index.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Import CSS
import './css/main.css';
import './css/cpt.css';

const root = ReactDOM.createRoot(document.getElementById('react-root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
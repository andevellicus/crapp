// index.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Import CSS
import '../public/css/main.css';
import '../public/css/cpt.css';

// Import interaction tracker
import './interaction-tracker';

const root = ReactDOM.createRoot(document.getElementById('react-root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
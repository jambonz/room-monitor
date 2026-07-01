import React from 'react';
import { createRoot } from 'react-dom/client';
import './tokens.css';
import { App } from './App.js';
import { PhonePage } from './PhonePage.js';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

// /#phone → the demo phone (one tab per participant); anything else → console.
// A "raw" suffix (e.g. #phone-raw, #raw) disables mic processing for e2e runs.
const isPhone = location.hash.replace('#', '').startsWith('phone');

createRoot(root).render(
  <React.StrictMode>{isPhone ? <PhonePage /> : <App />}</React.StrictMode>
);

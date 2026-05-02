import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import AgentBuilderPage from './ck8t/AgentBuilderPage';

// Apply saved theme before first paint
const savedTheme = localStorage.getItem('convengine_ui_theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AgentBuilderPage />
  </React.StrictMode>
);

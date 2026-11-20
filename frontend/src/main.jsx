import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
import './styles/staff-access.css';
import './theme.css';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';

createRoot(document.getElementById('root')).render(<React.StrictMode><BrowserRouter><ToastProvider><AuthProvider><App /></AuthProvider></ToastProvider></BrowserRouter></React.StrictMode>);

/**
 * main.jsx — Application Entry Point
 *
 * Purpose:      Mounts the React application into the DOM.
 *               Wraps the app with BrowserRouter (routing) and
 *               AuthProvider (global auth state) so both are
 *               available to every component in the tree.
 *
 * Dependencies: react, react-dom, react-router-dom
 *               AuthContext (src/context/AuthContext.jsx)
 *               Global styles (src/index.css — Tailwind directives)
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import { AuthProvider } from './context/AuthContext';

import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/*
      BrowserRouter — outermost so react-router-dom hooks (useNavigate,
      useLocation) are accessible anywhere, including inside AuthContext.
    */}
    <BrowserRouter>
      {/*
        AuthProvider — wraps App so every page and component can read
        auth state via useAuth() without prop drilling.
      */}
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
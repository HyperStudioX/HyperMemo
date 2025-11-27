import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './popup';
import { AuthProvider } from '@/contexts/AuthContext';
import { BookmarkProvider } from '@/contexts/BookmarkContext';
import './popup.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <BookmarkProvider>
        <App />
      </BookmarkProvider>
    </AuthProvider>
  </React.StrictMode>
);

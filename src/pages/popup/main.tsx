import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './popup';
import { AuthProvider } from '@/contexts/AuthContext';
import { BookmarkProvider } from '@/contexts/BookmarkContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import '@/i18n';
import '@/index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <ThemeProvider>
            <AuthProvider>
                <BookmarkProvider>
                    <App />
                </BookmarkProvider>
            </AuthProvider>
        </ThemeProvider>
    </React.StrictMode>
);

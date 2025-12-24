import React from 'react';
import ReactDOM from 'react-dom/client';
import DashboardApp from './dashboard';
import { AuthProvider } from '@/contexts/AuthContext';
import { BookmarkProvider } from '@/contexts/BookmarkContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import '@/i18n';
import '@/index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <ErrorBoundary>
            <ThemeProvider>
                <AuthProvider>
                    <BookmarkProvider>
                        <DashboardApp />
                    </BookmarkProvider>
                </AuthProvider>
            </ThemeProvider>
        </ErrorBoundary>
    </React.StrictMode>
);

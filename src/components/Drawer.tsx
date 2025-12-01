import type { FC, ReactNode } from 'react';
import './Drawer.css';

interface DrawerProps {
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
    title?: string;
}

export const Drawer: FC<DrawerProps> = ({ isOpen, onClose, children, title }) => {
    if (!isOpen) return null;

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    };

    return (
        <>
            <div
                className="drawer-overlay"
                onClick={onClose}
                onKeyDown={handleKeyDown}
                role="button"
                tabIndex={0}
                aria-label="Close drawer"
            />
            <div className="drawer">
                <div className="drawer-header">
                    {title && <h2 className="drawer-title">{title}</h2>}
                    <button
                        type="button"
                        className="drawer-close"
                        onClick={onClose}
                        aria-label="Close drawer"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <title>Close</title>
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
                <div className="drawer-content">
                    {children}
                </div>
            </div>
        </>
    );
};

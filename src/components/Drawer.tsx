import type { FC, ReactNode } from 'react';
import { X } from 'lucide-react';

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
                className="fixed inset-0 bg-black/50 z-50"
                onClick={onClose}
                onKeyDown={handleKeyDown}
                role="button"
                tabIndex={0}
                aria-label="Close drawer"
            />
            <div className="fixed top-0 right-0 bottom-0 w-[480px] max-w-[90vw] bg-bg-main shadow-lg z-50 flex flex-col animate-fade-in">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    {title && <h2 className="text-xl font-semibold text-text-primary">{title}</h2>}
                    <button
                        type="button"
                        className="w-10 h-10 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-subtle transition-colors"
                        onClick={onClose}
                        aria-label="Close drawer"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    {children}
                </div>
            </div>
        </>
    );
};

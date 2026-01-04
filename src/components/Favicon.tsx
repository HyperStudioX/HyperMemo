import type React from 'react';
import { useState, memo } from 'react';
import { Globe } from 'lucide-react';

interface FaviconProps {
    url: string;
    size?: number;
    className?: string;
    fallbackClassName?: string;
}

export const Favicon = memo(function Favicon({
    url,
    size = 32,
    className = "w-4 h-4 rounded-sm",
    fallbackClassName = "w-3 h-3 text-text-secondary"
}: FaviconProps) {
    const [isError, setIsError] = useState(false);

    let hostname = '';
    try {
        hostname = new URL(url).hostname;
    } catch {
        hostname = '';
    }

    if (!hostname || isError) {
        return <Globe className={fallbackClassName} />;
    }

    // Use Chrome's internal favicon API if available (preferred for extensions)
    // This requires the 'favicon' permission in manifest.json
    const faviconUrl = typeof chrome !== 'undefined' && chrome.runtime?.id
        ? `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=${size}`
        : `https://www.google.com/s2/favicons?domain=${hostname}&sz=${size}`;

    return (
        <img
            src={faviconUrl}
            alt=""
            className={className}
            onError={() => setIsError(true)}
        />
    );
});

import type { RuntimeMessage } from '@/types/messages';

chrome.runtime.onInstalled.addListener(() => {
    console.info('HyperMemo installed.');
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
    if (message.type === 'REQUEST_PAGE_CONTEXT') {
        handlePageContextRequest().then((payload) => {
            if (payload) {
                sendResponse({ type: 'PAGE_CONTEXT', payload } satisfies RuntimeMessage);
            } else {
                sendResponse(undefined);
            }
        }).catch((error) => {
            console.error('Context request failed', error);
            sendResponse(undefined);
        });
        return true;
    }
    return false;
});

async function handlePageContextRequest() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return undefined;
    try {
        const response = (await chrome.tabs.sendMessage(tab.id, {
            type: 'CAPTURE_CONTENT'
        } satisfies RuntimeMessage)) as RuntimeMessage | undefined;
        if (response?.type === 'CONTENT_CAPTURED') {
            return response.payload;
        }
    } catch (error) {
        console.warn('Failed to read page content', error);
    }
    return {
        title: tab.title ?? 'Untitled',
        url: tab.url ?? '',
        description: tab.url ?? ''
    };
}

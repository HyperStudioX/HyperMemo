import type { RuntimeMessage } from '@/types/messages';

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === 'CAPTURE_CONTENT') {
    const payload = {
      title: document.title,
      url: window.location.href,
      description:
        document.querySelector('meta[name="description"]')?.getAttribute('content') ??
        undefined,
      content: document.body?.innerText ?? undefined,
      language: document.documentElement.lang || navigator.language,
      favicon: (
        document.querySelector('link[rel="icon"]') as HTMLLinkElement | null
      )?.href
    };
    sendResponse({ type: 'CONTENT_CAPTURED', payload } satisfies RuntimeMessage);
    return true;
  }
  return false;
});

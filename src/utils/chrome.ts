import type { PageContextPayload, RuntimeMessage } from '@/types/messages';

export const chromeApiAvailable =
  typeof chrome !== 'undefined' && !!chrome?.runtime && !!chrome?.storage;

export const chromeStorage = {
  async get<T>(key: string, fallback: T): Promise<T> {
    if (!chromeApiAvailable) return fallback;
    const result = await chrome.storage.local.get([key]);
    return (result[key] as T) ?? fallback;
  },
  async set<T>(key: string, value: T): Promise<void> {
    if (!chromeApiAvailable) return;
    await chrome.storage.local.set({ [key]: value });
  }
};

export async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  if (!chromeApiAvailable || !chrome.tabs) return undefined;
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

export async function requestPageContext(): Promise<PageContextPayload | undefined> {
  if (!chromeApiAvailable || !chrome.runtime) return undefined;
  const response = (await chrome.runtime.sendMessage({
    type: 'REQUEST_PAGE_CONTEXT'
  } satisfies RuntimeMessage)) as RuntimeMessage | undefined;
  if (response && response.type === 'PAGE_CONTEXT') {
    return response.payload;
  }
  return undefined;
}

export async function sendMessageToTab(
  tabId: number,
  message: RuntimeMessage
): Promise<RuntimeMessage | undefined> {
  if (!chromeApiAvailable) return undefined;
  return (await chrome.tabs.sendMessage(tabId, message)) as RuntimeMessage | undefined;
}

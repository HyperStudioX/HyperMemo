import { firebaseAuth } from '@/services/firebase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function ensureBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error('VITE_API_BASE_URL is not configured.');
  }
  return API_BASE_URL.replace(/\/$/, '');
}

async function authHeaders(): Promise<Headers> {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const currentUser = firebaseAuth.currentUser;
  if (currentUser) {
    const token = await currentUser.getIdToken();
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = ensureBaseUrl();
  const auth = await authHeaders();
  const requestHeaders = new Headers(init?.headers || {});
  auth.forEach((value, key) => requestHeaders.set(key, value));
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: requestHeaders
  });
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T) : (undefined as T);
  if (!response.ok) {
    throw new ApiError(response.statusText || 'API request failed', response.status, payload);
  }
  return payload;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined
    }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' })
};

export type { ApiError };

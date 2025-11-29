import { onAuthStateChanged, type User } from 'firebase/auth';
import { firebaseAuth } from '@/services/firebase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const WAIT_FOR_USER_TIMEOUT_MS = Number(import.meta.env.VITE_AUTH_WAIT_TIMEOUT_MS ?? 5000);

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

let authStatePromise: Promise<User | null> | null = null;

async function waitForUser(): Promise<User | null> {
  const current = firebaseAuth.currentUser;
  if (current) {
    try {
      await current.reload();
    } catch {
      // ignore reload failures; we'll fall back to current state
    }
    return firebaseAuth.currentUser;
  }
  if (!authStatePromise) {
    authStatePromise = new Promise<User | null>((resolve) => {
      let resolved = false;
      let timeoutId: number | undefined;
      const unsubscribe = onAuthStateChanged(
        firebaseAuth,
        (resolvedUser) => {
          if (resolvedUser && !resolved) {
            resolved = true;
            if (timeoutId !== undefined) {
              clearTimeout(timeoutId);
            }
            unsubscribe();
            resolve(resolvedUser);
          }
        },
        () => {
          if (!resolved) {
            resolved = true;
            if (timeoutId !== undefined) {
              clearTimeout(timeoutId);
            }
            unsubscribe();
            resolve(null);
          }
        }
      );
      timeoutId = window.setTimeout(() => {
        if (!resolved) {
          resolved = true;
          unsubscribe();
          resolve(firebaseAuth.currentUser);
        }
      }, WAIT_FOR_USER_TIMEOUT_MS);
    }).finally(() => {
      authStatePromise = null;
    });
  }
  return authStatePromise;
}

async function authHeaders(): Promise<Headers> {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const currentUser = await waitForUser();
  if (currentUser) {
    try {
      const token = await currentUser.getIdToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      } else {
        console.warn('getIdToken returned empty token');
      }
    } catch (error) {
      console.error('Failed to get ID token:', error);
      // Continue without auth header - backend will return 401 with proper error message
    }
  }
  return headers;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = ensureBaseUrl();
  const auth = await authHeaders();
  const requestHeaders = new Headers(init?.headers || {});
  auth.forEach((value, key) => requestHeaders.set(key, value));
  
  const url = `${baseUrl}${path}`;
  console.debug('API request:', { method: init?.method || 'GET', url, hasAuth: requestHeaders.has('Authorization') });
  
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: requestHeaders
    });
  } catch (error) {
    console.error('Network error during fetch:', error);
    throw new ApiError(
      error instanceof Error ? error.message : 'Network error',
      0,
      { error: 'Failed to connect to server' }
    );
  }
  
  const text = await response.text();
  let payload: T | undefined;
  if (text) {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      try {
        payload = JSON.parse(text) as T;
      } catch (error) {
        console.warn('Failed to parse JSON response', error, text);
        payload = undefined;
      }
    } else {
      payload = text as unknown as T;
    }
  }
  
  if (!response.ok) {
    console.error('API error response:', {
      status: response.status,
      statusText: response.statusText,
      body: payload,
      url
    });
    throw new ApiError(response.statusText || 'API request failed', response.status, payload);
  }
  
  return payload as T;
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

export { ApiError };

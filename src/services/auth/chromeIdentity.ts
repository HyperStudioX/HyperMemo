import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { firebaseAuth } from '@/services/firebase';

const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID ?? '';

const GOOGLE_OAUTH_SCOPES = ['openid', 'email', 'profile'];

function generateNonce(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const array = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < array.length; i += 1) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function ensureChromeIdentity(): typeof chrome.identity {
  if (typeof chrome === 'undefined' || !chrome.identity) {
    throw new Error('Chrome identity API is unavailable in this context.');
  }
  return chrome.identity;
}

function ensureClientId(): string {
  if (!clientId) {
    throw new Error('Missing VITE_GOOGLE_OAUTH_CLIENT_ID env variable.');
  }
  return clientId;
}

async function runWebAuthFlow(): Promise<string> {
  const identity = ensureChromeIdentity();
  const redirectUri = identity.getRedirectURL();
  if (import.meta.env.DEV) {
    console.log('[HyperMemo] Chrome Identity redirect URL:', redirectUri);
  }
  const params = new URLSearchParams({
    client_id: ensureClientId(),
    response_type: 'token id_token',
    redirect_uri: redirectUri,
    scope: GOOGLE_OAUTH_SCOPES.join(' '),
    prompt: 'select_account',
    include_granted_scopes: 'true',
    nonce: generateNonce(),
    state: generateNonce()
  });
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return new Promise((resolve, reject) => {
    identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (responseUrl) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!responseUrl) {
        reject(new Error('Google OAuth cancelled.'));
        return;
      }
      resolve(responseUrl);
    });
  });
}

function extractIdToken(responseUrl: string): string {
  const fragment = responseUrl.split('#')[1] ?? '';
  const params = new URLSearchParams(fragment);
  const token = params.get('id_token');
  if (!token) {
    throw new Error('Google OAuth missing id_token.');
  }
  return token;
}

export async function loginWithChromeIdentity(): Promise<void> {
  const responseUrl = await runWebAuthFlow();
  const idToken = extractIdToken(responseUrl);
  const credential = GoogleAuthProvider.credential(idToken);
  await signInWithCredential(firebaseAuth, credential);
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import type { User } from 'firebase/auth';
import { firebaseAuth, googleProvider } from '@/services/firebase';
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { loginWithChromeIdentity } from '@/services/auth/chromeIdentity';

export type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const value = useProvideAuth();
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}

function useProvideAuth(): AuthContextValue {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const attemptedAnonRef = useRef(false);
  const autoAnonEnabled =
    !import.meta.env.VITE_AUTO_ANON_LOGIN ||
    !/^(false|0|no|off)$/i.test(import.meta.env.VITE_AUTO_ANON_LOGIN);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
      if (!nextUser && autoAnonEnabled && !attemptedAnonRef.current) {
        attemptedAnonRef.current = true;
        void signInAnonymously(firebaseAuth).catch((error) => {
          console.warn('Failed to sign in anonymously', error);
        });
      }
    });
    return () => unsubscribe();
  }, [autoAnonEnabled]);

  const login = useCallback(async () => {
    try {
      const canUseChromeIdentity =
        typeof chrome !== 'undefined' && !!chrome.identity?.launchWebAuthFlow;
      if (canUseChromeIdentity) {
        await loginWithChromeIdentity();
      } else {
        await signInWithPopup(firebaseAuth, googleProvider);
      }
    } catch (error) {
      console.warn('Firebase login failed', error);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut(firebaseAuth);
    } catch (error) {
      console.warn('Firebase logout failed', error);
    }
  }, []);

  return useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
}

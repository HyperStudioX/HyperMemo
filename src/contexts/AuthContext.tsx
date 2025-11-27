import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import type { User } from 'firebase/auth';
import { firebaseAuth, googleProvider } from '@/services/firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = useCallback(async () => {
    try {
      await signInWithPopup(firebaseAuth, googleProvider);
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

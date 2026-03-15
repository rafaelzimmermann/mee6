import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { checkMe, checkSetupRequired } from '../api/auth';

type AuthState = 'loading' | 'setup_required' | 'unauthenticated' | 'authenticated';

interface AuthContextValue {
  state: AuthState;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>('loading');

  useEffect(() => {
    (async () => {
      const { setup_required } = await checkSetupRequired();
      if (setup_required) { setState('setup_required'); return; }
      const ok = await checkMe();
      setState(ok ? 'authenticated' : 'unauthenticated');
    })();
  }, []);

  const login  = () => setState('authenticated');
  const logout = () => setState('unauthenticated');

  return (
    <AuthContext.Provider value={{ state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

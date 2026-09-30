import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LoginInput, Me, RegisterInput, UpdateProfileInput } from '@dinkup/shared';
import { api } from './api.ts';

type AuthState = {
  user: Me | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  tryDemo: () => Promise<void>;
  updateProfile: (input: UpdateProfileInput) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ user: Me | null }>('GET', '/auth/me')
      .then((res) => setUser(res.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const res = await api<{ user: Me }>('POST', '/auth/login', input);
    setUser(res.user);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const res = await api<{ user: Me }>('POST', '/auth/register', input);
    setUser(res.user);
  }, []);

  const tryDemo = useCallback(async () => {
    const res = await api<{ user: Me }>('POST', '/auth/demo');
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    await api('POST', '/auth/logout');
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (input: UpdateProfileInput) => {
    const res = await api<{ user: Me }>('PATCH', '/users/me', input);
    setUser(res.user);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, tryDemo, updateProfile }),
    [user, loading, login, register, logout, tryDemo, updateProfile],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

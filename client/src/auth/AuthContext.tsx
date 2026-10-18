import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api, setUnauthorizedHandler } from '../api/client';
import { Role, User } from '../types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

// Context = "global state" that any component can read without passing props down every level.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On first load, ask the server "who am I?" (the cookie is sent automatically).
  useEffect(() => {
    api
      .get<User>('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
    setUnauthorizedHandler(() => setUser(null));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<User>('/auth/login', { email, password });
    setUser(res.data);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await api.post<User>('/auth/register', { name, email, password });
    setUser(res.data);
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => undefined);
    setUser(null);
  }, []);

  const hasRole = useCallback((...roles: Role[]) => !!user && roles.includes(user.role), [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, hasRole }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

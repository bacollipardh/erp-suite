import * as SecureStore from 'expo-secure-store';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { apiRequest, resolveApiUrl } from '../lib/api';
import type { SessionUser } from '../lib/permissions';

const TOKEN_KEY = 'erp_mobile_token';
const API_URL_KEY = 'erp_mobile_api_url';

type AuthContextValue = {
  user: SessionUser | null;
  token: string | null;
  apiUrl: string;
  loading: boolean;
  login: (params: {
    apiUrl: string;
    email: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setApiUrl: (value: string) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type LoginResponse = {
  accessToken: string;
  user: SessionUser;
};

async function saveSession(token: string, apiUrl: string) {
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, token),
    SecureStore.setItemAsync(API_URL_KEY, resolveApiUrl(apiUrl)),
  ]);
}

async function clearSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(API_URL_KEY),
  ]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [apiUrl, setApiUrlState] = useState(resolveApiUrl(null));
  const [loading, setLoading] = useState(true);

  const setApiUrl = useCallback((value: string) => {
    setApiUrlState(resolveApiUrl(value));
  }, []);

  const refresh = useCallback(async () => {
    if (!token) {
      setUser(null);
      return;
    }

    const nextUser = await apiRequest<SessionUser>(apiUrl, '/auth/me', {
      token,
    });
    setUser(nextUser);
  }, [apiUrl, token]);

  const logout = useCallback(async () => {
    setUser(null);
    setToken(null);
    await clearSession();
  }, []);

  const login = useCallback(
    async ({
      apiUrl: nextApiUrl,
      email,
      password,
    }: {
      apiUrl: string;
      email: string;
      password: string;
    }) => {
      const normalizedApiUrl = resolveApiUrl(nextApiUrl);
      const result = await apiRequest<LoginResponse>(
        normalizedApiUrl,
        '/auth/login',
        {
          method: 'POST',
          body: {
            email: email.trim(),
            password,
          },
        },
      );

      setApiUrlState(normalizedApiUrl);
      setToken(result.accessToken);
      setUser(result.user);
      await saveSession(result.accessToken, normalizedApiUrl);
    },
    [],
  );

  useEffect(() => {
    let alive = true;

    async function bootstrap() {
      try {
        const [storedToken, storedApiUrl] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(API_URL_KEY),
        ]);

        const normalizedApiUrl = resolveApiUrl(storedApiUrl);
        if (!alive) return;
        setApiUrlState(normalizedApiUrl);

        if (!storedToken) {
          setToken(null);
          setUser(null);
          setLoading(false);
          return;
        }

        setToken(storedToken);
        try {
          const nextUser = await apiRequest<SessionUser>(
            normalizedApiUrl,
            '/auth/me',
            {
              token: storedToken,
            },
          );
          if (!alive) return;
          setUser(nextUser);
        } catch {
          if (!alive) return;
          setUser(null);
          setToken(null);
          await clearSession();
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    void bootstrap();

    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      apiUrl,
      loading,
      login,
      logout,
      refresh,
      setApiUrl,
    }),
    [apiUrl, loading, login, logout, refresh, setApiUrl, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}

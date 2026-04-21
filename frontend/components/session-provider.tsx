'use client';

import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { clientSession } from '@/lib/auth-client';

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  permissions: string[];
};

type SessionContextValue = {
  user: SessionUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  clear: () => void;
};

const SessionContext = createContext<SessionContextValue>({
  user: null,
  loading: true,
  refresh: async () => undefined,
  clear: () => undefined,
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const session = await clientSession();
      setUser(session.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      refresh,
      clear: () => setUser(null),
    }),
    [user, loading],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}

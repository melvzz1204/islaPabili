import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Which shell the user signed in for. Picked on the auth screens
 * (customer / rider; merchant stores are still onboarding) and persisted,
 * so a rider lands back in the rider dashboard after a restart.
 *
 * Switching shells always goes through logout — the rider dashboard and the
 * customer app never render in the same session.
 */
export type AuthMode = 'customer' | 'rider';

const STORAGE_KEY = 'islapabili_auth_mode_v1';

type AuthModeValue = {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  loaded: boolean;
  /** True right after a rider logout — Root parks on the sign-in page. */
  loggedOut: boolean;
  setLoggedOut: (value: boolean) => void;
};

const AuthModeContext = createContext<AuthModeValue | null>(null);

export function AuthModeProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<AuthMode>('customer');
  const [loaded, setLoaded] = useState(false);
  const [loggedOut, setLoggedOutState] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!active) return;
        if (raw === 'rider' || raw === 'customer') setModeState(raw);
        setLoaded(true);
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const setLoggedOut = useCallback((value: boolean) => {
    setLoggedOutState(value);
  }, []);

  const value = useMemo<AuthModeValue>(
    () => ({
      mode,
      setMode: (next) => {
        setModeState(next);
        void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
      },
      loaded,
      loggedOut,
      setLoggedOut,
    }),
    [mode, loaded, loggedOut, setLoggedOut],
  );

  return <AuthModeContext.Provider value={value}>{children}</AuthModeContext.Provider>;
}

export function useAuthMode(): AuthModeValue {
  const ctx = useContext(AuthModeContext);
  if (!ctx) throw new Error('useAuthMode must be used within an AuthModeProvider');
  return ctx;
}

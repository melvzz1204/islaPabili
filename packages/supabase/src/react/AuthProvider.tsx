import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Supabase } from '../client';
import type { Database } from '../database';
import { resolveProviderAvatar } from '../auth';

export type Profile = Database['public']['Tables']['profiles']['Row'];

type AuthContextValue = {
  client: Supabase;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  /** True after the first profile fetch for the current session completes. */
  profileLoaded: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ client, children }: PropsWithChildren<{ client: Supabase }>) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  // Tracks whether we already hold a profile so background refreshes
  // (token renewal, tab visibility regain) update silently instead of
  // flashing the full-screen loader on Alt+Tab return.
  const hasProfileRef = useRef(false);

  const refreshProfile = useCallback(async () => {
    const { data: authData } = await client.auth.getUser();
    const user = authData.user;
    const userId = user?.id;
    if (!userId) {
      hasProfileRef.current = false;
      setProfile(null);
      setProfileLoading(false);
      setProfileLoaded(true);
      return;
    }
    if (!hasProfileRef.current) setProfileLoading(true);
    const { data } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (data) {
      hasProfileRef.current = true;
      // OAuth (Google/Facebook) users: adopt the provider profile picture
      // when the profile has none yet — or replace an expiring Facebook
      // lookaside URL with the longer-lived Google photo when the account
      // has both identities linked. Never overwrites an uploaded photo.
      const resolved = resolveProviderAvatar(user);
      const storedUnstable =
        !!data.avatar_url && data.avatar_url.includes('platform-lookaside.fbsbx.com');
      if (resolved && data.avatar_url !== resolved && (!data.avatar_url || storedUnstable)) {
        const { data: updated } = await client
          .from('profiles')
          .update({ avatar_url: resolved })
          .eq('id', userId)
          .select('*')
          .maybeSingle();
        setProfile(updated ?? { ...data, avatar_url: resolved });
      } else {
        setProfile(data);
      }
    }
    setProfileLoading(false);
    setProfileLoaded(true);
  }, [client]);

  useEffect(() => {
    let active = true;
    void client.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        setProfileLoaded(false);
        void refreshProfile();
      } else {
        hasProfileRef.current = false;
        setProfile(null);
        setProfileLoaded(false);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [client, refreshProfile]);

  const value = useMemo(
    () => ({ client, session, profile, loading, profileLoading, profileLoaded, refreshProfile }),
    [client, loading, profile, profileLoading, profileLoaded, refreshProfile, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
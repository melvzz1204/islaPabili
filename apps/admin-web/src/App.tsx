import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { signOut } from '@isla/supabase';
import { supabase } from './lib/supabase';
import { AdminLogin } from './screens/Auth';
import { RiderApplications, type RiderRow } from './screens/RiderApplications';
import { RiderReview } from './screens/RiderReview';

type View =
  | { name: 'loading' }
  | { name: 'login' }
  | { name: 'forbidden' }
  | { name: 'list' }
  | { name: 'review'; row: RiderRow };

export default function App() {
  const [view, setView] = useState<View>({ name: 'loading' });
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  const route = useCallback(async (session: Session | null) => {
    if (!session) {
      setAdminEmail(null);
      setView({ name: 'login' });
      return;
    }
    // The UI gate is convenience only — RLS is the real boundary. Checking the
    // role here just avoids showing a console to someone who cannot use it.
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, email')
      .eq('id', session.user.id)
      .maybeSingle();
    if (profile?.role !== 'admin') {
      setView({ name: 'forbidden' });
      return;
    }
    setAdminEmail(profile.email ?? session.user.email ?? null);
    setView({ name: 'list' });
  }, []);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) void route(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) void route(session);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [route]);

  const handleSignOut = async () => {
    await signOut(supabase);
    setView({ name: 'login' });
  };

  return (
    <>
      <header className="topbar">
        <span className="brand">
          <img className="brand-logo" src="/islapabili_logo.svg" alt="IslaPabili logo" /> IslaPabili Admin
        </span>
        {view.name === 'list' || view.name === 'review' ? (
          <div className="row-between">
            {adminEmail ? <span className="hint">{adminEmail}</span> : null}
            <button type="button" className="isla-btn isla-btn-secondary isla-btn-sm" onClick={() => void handleSignOut()}>
              Log out
            </button>
          </div>
        ) : null}
      </header>
      <main className={`page ${view.name === 'login' || view.name === 'forbidden' ? 'page-narrow' : ''}`}>
        {view.name === 'loading' ? (
          <div className="isla-card">
            <p>Loading…</p>
          </div>
        ) : view.name === 'login' ? (
          <AdminLogin onSignedIn={() => void supabase.auth.getSession().then(({ data }) => route(data.session))} />
        ) : view.name === 'forbidden' ? (
          <div className="isla-card">
            <h1>Admins only</h1>
            <p>This account does not have the admin role, so it cannot use the console.</p>
            <button type="button" className="isla-btn isla-btn-secondary" onClick={() => void handleSignOut()}>
              Log out
            </button>
          </div>
        ) : view.name === 'review' ? (
          <RiderReview
            row={view.row}
            onBack={() => setView({ name: 'list' })}
            onReviewed={() => setView({ name: 'list' })}
          />
        ) : (
          <RiderApplications onOpen={(row) => setView({ name: 'review', row })} />
        )}
      </main>
    </>
  );
}

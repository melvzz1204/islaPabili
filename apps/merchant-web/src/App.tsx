import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Database } from '@isla/supabase';
import { supabase } from './lib/supabase';
import { LoginForm, RegisterForm } from './screens/Auth';
import { ApplyForm } from './screens/Apply';
import { StatusScreen } from './screens/Status';
import { Dashboard } from './screens/Dashboard';

type Merchant = Database['public']['Tables']['merchants']['Row'];
type Application = Database['public']['Tables']['merchant_applications']['Row'];

type View =
  | { name: 'loading' }
  | { name: 'login' }
  | { name: 'register' }
  | { name: 'apply'; userId: string }
  | { name: 'status'; application: Application }
  | { name: 'dashboard'; merchant: Merchant };

export default function App() {
  const [view, setView] = useState<View>({ name: 'loading' });

  const route = useCallback(async (session: Session | null) => {
    if (!session) {
      setView((v) => (v.name === 'register' ? v : { name: 'login' }));
      return;
    }
    const uid = session.user.id;
    const [{ data: ownership }, { data: application }] = await Promise.all([
      supabase.from('merchant_owners').select('merchant_id, merchants(*)').eq('profile_id', uid).limit(1),
      supabase.from('merchant_applications').select('*').eq('applicant_id', uid).maybeSingle(),
    ]);
    const merchant = ownership?.[0]?.merchants ?? null;
    if (merchant && typeof merchant === 'object' && 'id' in merchant) {
      setView({ name: 'dashboard', merchant: merchant as Merchant });
    } else if (application) {
      setView({ name: 'status', application });
    } else {
      setView({ name: 'apply', userId: uid });
    }
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

  const refresh = async () => {
    const { data } = await supabase.auth.getSession();
    await route(data.session);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setView({ name: 'login' });
  };

  return (
    <>
      <header className="topbar">
        <span className="brand">
          <img className="brand-logo" src="/islapabili_logo.svg" alt="IslaPabili logo" /> IslaPabili Merchant
        </span>
        {view.name === 'dashboard' || view.name === 'status' || view.name === 'apply' ? (
          <button type="button" className="isla-btn isla-btn-secondary isla-btn-sm" onClick={() => void signOut()}>
            Log out
          </button>
        ) : null}
      </header>
      <main className={`page ${view.name === 'login' || view.name === 'register' ? 'page-narrow' : ''}`}>
        {view.name === 'loading' ? (
          <div className="isla-card"><p>Loading…</p></div>
        ) : view.name === 'login' ? (
          <LoginForm onRegister={() => setView({ name: 'register' })} />
        ) : view.name === 'register' ? (
          <RegisterForm onDone={() => void refresh()} onLogin={() => setView({ name: 'login' })} />
        ) : view.name === 'apply' ? (
          <ApplyForm userId={view.userId} onSubmitted={() => void refresh()} />
        ) : view.name === 'status' ? (
          <StatusScreen application={view.application} onRefresh={() => void refresh()} />
        ) : (
          <Dashboard merchant={view.merchant} onSignOut={() => void signOut()} />
        )}
      </main>
    </>
  );
}

import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { useAdminData } from './lib/adminData';
import { Shell, type AdminTab } from './components/layout';
import { AdminLogin } from './screens/Auth';
import { Dashboard } from './screens/Dashboard';
import { Orders } from './screens/Orders';
import { Riders } from './screens/Riders';
import { Merchants } from './screens/Merchants';
import { Customers } from './screens/Customers';
import { Finance } from './screens/Finance';
import { Settings } from './screens/Settings';

type View =
  | { name: 'loading' }
  | { name: 'login' }
  | { name: 'forbidden' }
  | { name: 'app'; tab: AdminTab };

export default function App() {
  const [view, setView] = useState<View>({ name: 'loading' });
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const { data, loading, error, reload } = useAdminData();

  const route = useCallback(async (session: Session | null) => {
    if (!session) {
      setAdminEmail(null);
      setView({ name: 'login' });
      return;
    }
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
    setView((v) => (v.name === 'app' ? v : { name: 'app', tab: 'dashboard' }));
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

  if (view.name === 'loading') {
    return (
      <div className="boot">
        <img src="/islapabili_logo.png" alt="IslaPabili" />
        <p>Opening island console…</p>
      </div>
    );
  }

  if (view.name === 'login') {
    return (
      <div className="auth-page">
        <AdminLogin onSignedIn={() => void supabase.auth.getSession().then(({ data }) => route(data.session))} />
      </div>
    );
  }

  if (view.name === 'forbidden') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Admins only</h1>
          <p className="muted">This account does not have the admin role.</p>
          <button type="button" className="btn btn-secondary" onClick={() => void supabase.auth.signOut()}>
            Log out
          </button>
        </div>
      </div>
    );
  }

  const pendingApps = data.riderApps.filter((a) => a.status === 'pending').length;

  return (
    <Shell
      tab={view.tab}
      setTab={(tab) => setView({ name: 'app', tab })}
      email={adminEmail}
      pendingApps={pendingApps}
    >
      {error ? <p className="banner-error" role="alert">{error} <button type="button" onClick={() => void reload()}>Retry</button></p> : null}
      {view.tab === 'dashboard' ? <Dashboard data={data} loading={loading} go={(t) => setView({ name: 'app', tab: t })} /> : null}
      {view.tab === 'orders' ? <Orders data={data} loading={loading} /> : null}
      {view.tab === 'riders' ? <Riders data={data} loading={loading} reload={reload} /> : null}
      {view.tab === 'merchants' ? <Merchants data={data} loading={loading} reload={reload} /> : null}
      {view.tab === 'customers' ? <Customers data={data} loading={loading} reload={reload} /> : null}
      {view.tab === 'finance' ? <Finance data={data} loading={loading} reload={reload} /> : null}
      {view.tab === 'settings' ? <Settings data={data} reload={reload} /> : null}
    </Shell>
  );
}

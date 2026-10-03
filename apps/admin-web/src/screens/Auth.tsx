import { useState } from 'react';
import { signInWithPassword } from '@isla/supabase';
import { supabase } from '../lib/supabase';
import { Field } from '../components/ui';

export function AdminLogin({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your admin email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: signInError } = await signInWithPassword(supabase, {
      login: email.trim(),
      password,
    });
    setBusy(false);
    if (signInError) {
      setError(signInError);
      return;
    }
    onSignedIn();
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <img src="/islapabili_logo.png" alt="IslaPabili" />
          <span>Island admin console</span>
        </div>
        <h1>Welcome back, Admin</h1>
        <p className="muted">Live view of orders, riders, stores and money across Marinduque.</p>
        <form onSubmit={(e) => void submit(e)} className="stack-sm">
          <Field label="Admin email">
            <input
              className="input"
              type="email"
              placeholder="admin@islapabili.ph"
              autoCapitalize="none"
              autoCorrect="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Password">
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error ? <p className="error" role="alert">{error}</p> : null}
          <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in to console →'}
          </button>
          <p className="muted center">No public sign-up — accounts are provisioned by superadmin. RLS enforces access.</p>
        </form>
      </div>
      <div className="auth-side">
        <div className="auth-metric"><strong>₱45 + ₱15/km</strong><span>transparent island fare</span></div>
        <div className="auth-metric"><strong>Live</strong><span>orders · riders · stores</span></div>
        <p>“Salamat sa pag-Pabili” — every completed order, rated and settled.</p>
      </div>
    </div>
  );
}

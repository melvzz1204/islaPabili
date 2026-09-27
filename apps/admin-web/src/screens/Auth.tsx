import { useState } from 'react';
import { signInWithPassword } from '@isla/supabase';
import { supabase } from '../lib/supabase';
import { Field } from '../components/ui';

/**
 * Admin sign-in only. There is deliberately no register form here: accounts are
 * provisioned by superadmin, and the caller re-checks the admin role after
 * sign-in so a valid customer account still cannot reach the console.
 */
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
    <form onSubmit={(e) => void submit(e)} className="isla-card">
      <img className="auth-logo" src="/islapabili_logo.svg" alt="IslaPabili logo" />
      <h1>IslaPabili Admin</h1>
      <p>Review rider applications and manage the marketplace.</p>
      <Field label="Admin email">
        <input
          className="isla-input"
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
          className="isla-input"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="isla-btn isla-btn-primary" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

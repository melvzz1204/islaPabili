import { useState } from 'react';
import { isValidUsername } from '@isla/shared';
import { isUsernameTaken, signInWithPassword, signUpWithPassword } from '@isla/supabase';
import { supabase } from '../lib/supabase';
import { Field } from '../components/ui';

export function LoginForm({ onRegister }: { onRegister: () => void }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login.trim() || !password) {
      setError('Enter your username or email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await signInWithPassword(supabase, { login, password });
    setBusy(false);
    if (error) setError(error);
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="isla-card">
      <img className="auth-logo" src="/islapabili_logo.svg" alt="IslaPabili logo" />
      <h1>Merchant login</h1>
      <p>Manage your store catalog on IslaPabili.</p>
      <Field label="Username or email">
        <input
          className="isla-input"
          placeholder="tindahan_boac or you@example.com"
          autoCapitalize="none"
          autoCorrect="off"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
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
      {error ? <p className="error" role="alert">{error}</p> : null}
      <button type="submit" className="isla-btn isla-btn-primary" disabled={busy}>
        {busy ? 'Logging in…' : 'Log in'}
      </button>
      <p>
        New merchant?{' '}
        <button type="button" className="isla-btn isla-btn-secondary isla-btn-sm" onClick={onRegister}>
          Create a merchant account
        </button>
      </p>
    </form>
  );
}

export function RegisterForm({ onDone, onLogin }: { onDone: () => void; onLogin: () => void }) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim().length < 2) {
      setError('Please enter your full name.');
      return;
    }
    if (!isValidUsername(username)) {
      setError('Username must be 3-20 characters: letters, numbers, underscores.');
      return;
    }
    if (email.trim() && !email.includes('@')) {
      setError('That email address looks invalid.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    if (await isUsernameTaken(supabase, username)) {
      setBusy(false);
      setError('That username is taken. Try another one.');
      return;
    }
    const { error } = await signUpWithPassword(supabase, {
      username,
      email: email.trim() || undefined,
      password,
      fullName: fullName.trim(),
    });
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      onDone();
    } else {
      setNotice('Account created! Confirm your email, then log in to apply as a merchant.');
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="isla-card">
      <img className="auth-logo" src="/islapabili_logo.svg" alt="IslaPabili logo" />
      <h1>Create merchant account</h1>
      <p>One account per store. Approval takes 1–2 business days.</p>
      <Field label="Full name">
        <input className="isla-input" placeholder="Maria Santos" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </Field>
      <Field label="Username">
        <input
          className="isla-input"
          placeholder="tindahan_boac"
          autoCapitalize="none"
          autoCorrect="off"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </Field>
      <Field label="Email (optional)">
        <input
          className="isla-input"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label="Password">
        <input
          className="isla-input"
          type="password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
      <button type="submit" className="isla-btn isla-btn-primary" disabled={busy}>
        {busy ? 'Creating…' : 'Create account'}
      </button>
      <p>
        Already registered?{' '}
        <button type="button" className="isla-btn isla-btn-secondary isla-btn-sm" onClick={onLogin}>
          Log in
        </button>
      </p>
    </form>
  );
}

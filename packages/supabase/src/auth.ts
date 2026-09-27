import type { Provider } from '@supabase/supabase-js';
import { authEmailForUsername, normalizeUsername, resolveAuthEmail } from '@isla/shared';
import type { Supabase } from './client';

export type AuthResult = {
  error: string | null;
};

function message(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Something went wrong. Please try again.';
}

export async function signUpWithPassword(
  client: Supabase,
  input: { username: string; email?: string; password: string; fullName: string },
): Promise<AuthResult> {
  const username = normalizeUsername(input.username);
  const email = input.email?.trim() ? input.email.trim() : authEmailForUsername(username);
  const { error } = await client.auth.signUp({
    email,
    password: input.password,
    options: { data: { username, full_name: input.fullName } },
  });
  return { error: message(error) };
}

export async function signInWithPassword(
  client: Supabase,
  input: { login: string; password: string },
): Promise<AuthResult> {
  const { error } = await client.auth.signInWithPassword({
    email: resolveAuthEmail(input.login),
    password: input.password,
  });
  return { error: message(error) };
}

export async function isUsernameTaken(client: Supabase, username: string): Promise<boolean> {
  const { data, error } = await client.rpc('is_username_taken', {
    p_username: normalizeUsername(username),
  });
  if (error) return false;
  return data === true;
}

export async function resendSignupEmail(client: Supabase, email: string): Promise<AuthResult> {
  const { error } = await client.auth.resend({ type: 'signup', email });
  return { error: message(error) };
}

export type OAuthResult = {
  url: string | null;
  error: string | null;
};

export async function signInWithProvider(
  client: Supabase,
  provider: Extract<Provider, 'google' | 'facebook'>,
  redirectTo: string,
): Promise<OAuthResult> {
  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) return { url: null, error: message(error) };
  return { url: data.url, error: null };
}

export async function exchangeOAuthCode(client: Supabase, url: string): Promise<AuthResult> {
  // The return URL looks like `<redirectTo>?code=<uuid>&sb_flow_id=<uuid>#_=_`
  // (Facebook appends `#_=_`). Parse query params properly so the fragment
  // never leaks into the code, and forward sb_flow_id so auth-js picks the
  // exact PKCE flow slot instead of guessing the most recent verifier.
  const queryStart = url.indexOf('?');
  const params = new URLSearchParams(queryStart >= 0 ? url.slice(queryStart + 1).split('#')[0] : '');
  const code = params.get('code');
  const flowId = params.get('sb_flow_id');
  if (!code) {
    return { error: 'No auth code found in the redirect URL.' };
  }
  const { error } = await client.auth.exchangeCodeForSession(
    code,
    flowId ? { flowId } : undefined,
  );
  return { error: message(error) };
}

export async function sendPhoneOtp(client: Supabase, phone: string): Promise<AuthResult> {
  const { error } = await client.auth.signInWithOtp({
    phone,
    options: { channel: 'sms', shouldCreateUser: true },
  });
  return { error: message(error) };
}

export async function verifyPhoneOtp(
  client: Supabase,
  input: { phone: string; token: string },
): Promise<AuthResult> {
  const { error } = await client.auth.verifyOtp({
    phone: input.phone,
    token: input.token,
    type: 'sms',
  });
  return { error: message(error) };
}

export async function signOut(client: Supabase): Promise<void> {
  await client.auth.signOut();
}
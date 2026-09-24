import type { Provider } from '@supabase/supabase-js';
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

export async function signUpWithEmail(
  client: Supabase,
  input: { email: string; password: string; fullName: string },
): Promise<AuthResult> {
  const { error } = await client.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { full_name: input.fullName } },
  });
  return { error: message(error) };
}

export async function signInWithEmail(
  client: Supabase,
  input: { email: string; password: string },
): Promise<AuthResult> {
  const { error } = await client.auth.signInWithPassword(input);
  return { error: message(error) };
}

export async function sendEmailOtp(client: Supabase, email: string): Promise<AuthResult> {
  const { error } = await client.auth.signInWithOtp({ email });
  return { error: message(error) };
}

export async function verifyEmailOtp(
  client: Supabase,
  input: { email: string; token: string },
): Promise<AuthResult> {
  const { error } = await client.auth.verifyOtp({ email: input.email, token: input.token, type: 'email' });
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
  const { error } = await client.auth.exchangeCodeForSession(url);
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
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

export type ProviderIdentity = {
  provider?: string;
  identity_data?: Record<string, unknown> | null;
};

export type AvatarUser = {
  user_metadata?: Record<string, unknown> | null;
  identities?: ProviderIdentity[] | null;
};

/**
 * Best profile picture for an auth user.
 *
 * Prefers long-lived URLs (Google `lh3.googleusercontent.com`) over expiring
 * ones (Facebook `platform-lookaside.fbsbx.com` lookaside URLs go stale and
 * often refuse to load inside React Native's image loader). Linked accounts
 * (Google + Facebook on one user) resolve to the Google photo.
 */
export function resolveProviderAvatar(user: AvatarUser | null | undefined): string | null {
  if (!user) return null;
  const pick = (obj: Record<string, unknown> | undefined | null): string | null => {
    if (!obj) return null;
    const v = obj.avatar_url ?? obj.picture;
    return typeof v === 'string' && v.startsWith('https://') ? v : null;
  };
  const identities = user.identities ?? [];
  const ordered = [
    ...identities.filter((i) => i?.provider === 'google'),
    ...identities.filter((i) => i?.provider !== 'google'),
  ];
  const candidates = [...ordered.map((i) => pick(i?.identity_data)), pick(user.user_metadata)];
  return (
    candidates.find((u) => u && !u.includes('platform-lookaside.fbsbx.com')) ??
    candidates.find((u) => !!u) ??
    null
  );
}

export async function signOut(client: Supabase): Promise<void> {
  // The revoke call can hang (offline / unreachable backend) — never let it
  // block logout UX. Cap it, then clear the local session regardless.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Sign-out timed out')), 8000);
  });
  try {
    await Promise.race([client.auth.signOut(), timeout]);
  } catch {
    // Session already expired, timed out, or offline — still clear local state.
    await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
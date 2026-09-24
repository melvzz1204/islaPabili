import {
  createClient,
  type SupabaseClient,
  type SupportedStorage,
} from '@supabase/supabase-js';
import type { Database } from './database';

export type SupabaseEnv = {
  url: string;
  publishableKey: string;
};

export type Supabase = SupabaseClient<Database>;

export function getSupabaseClient(env: SupabaseEnv, storage?: SupportedStorage): Supabase {
  return createClient<Database>(env.url, env.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      ...(storage ? { storage } : {}),
    },
  });
}
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient, type Supabase } from '@isla/supabase';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env');
}

export const supabase: Supabase = getSupabaseClient({ url, publishableKey }, AsyncStorage);